const express = require('express')
const app = express()
const port = 3000
const bodyParser = require('body-parser');
const axios = require('axios');
const fetch=require('node-fetch');
const ytdl = require('ytdl-core');
const YOUTUBE_API_KEY = '';
const session = require('express-session');
const cors = require('cors');
const bcrypt = require('bcrypt');
const saltRounds = 10; // Number of salt rounds to generate the salt
const RECAPTCHA_SECRET_KEY = '';
const cron = require('node-cron');
const mysql = require('mysql2/promise');



app.use(session({
    secret: 'ab-123', // Replace with a secure secret key for session encryption
    resave: false,
    saveUninitialized: true
}));

app.use(cors());

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'music_player',
    connectionLimit: 10 // Adjust the limit as needed
});

// Parse URL-encoded form data
app.use(bodyParser.urlencoded({ extended: true }));
// Parse URL-encoded form data
app.use(express.urlencoded({ extended: false }));
// to use css files (static files )
app.use(express.static('static'));

cron.schedule('20 15 * * *', async () => {
    try {
        // Fetch the top 30 trending Hindi songs from YouTube (replace 'your-api-key' with your YouTube Data API key)
        const response = await axios.get(
            'https://www.googleapis.com/youtube/v3/videos',
            {
                params: {
                    part: 'snippet',
                    chart: 'mostPopular',
                    regionCode: 'IN',
                    videoCategoryId: '10',
                    maxResults: 30,
                    key: YOUTUBE_API_KEY,
                },
            }
        );

        const trendingSongs = response.data.items.map(item => ({
            link: `https://www.youtube.com/watch?v=${item.id}`,
            title: item.snippet.title.replace(/'/g, "''"),
        }));

        // Retrieve existing links from the prevTrendingHindiSong table
        const existingLinksResult = await pool.execute('SELECT link FROM prevTrendingSong');
        const existingLinks = existingLinksResult.flat().map(row => row.link);

        // console.log(existingLinks);
        // Identify new links not present initially
        const newLinks = trendingSongs.filter(song => !existingLinks.includes(song.link));
        await pool.execute('TRUNCATE TABLE prevTrendingSong');
        await pool.execute('TRUNCATE TABLE daily_update');
        // console.log(newLinks);
        if (newLinks.length > 0) {
            const insertValues = newLinks.map(song => `('${song.link}', '${song.title}')`).join(',');

            // Insert new links into the daily_update table
            await pool.execute(`INSERT INTO daily_update (link,title) VALUES ${insertValues}`);
        }

        const trending = trendingSongs.map(song => `('${song.link}')`).join(',');
        await pool.execute(`INSERT INTO prevTrendingSong (link) VALUES ${trending}`);
        
        console.log('Updated successfully');
    } catch (error) {
        console.error('Error in scheduled task:', error.message);
    }
});
app.get('/api/check-data', async (req, res) => {
  try {
    // Query to retrieve titles from the daily_update table
    const query = 'SELECT title FROM daily_update';

    // Execute the query using the promise pool
    const [results] = await pool.execute(query);

    // Extract titles from the query results
    const titles = results.map(row => row.title);

    // console.log(titles);
    // Send the titles in the response
    res.json({ titles });
  } catch (error) {
    console.error('Error querying database:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// home page loading
app.get('/', (req, res) => {
    res.redirect('/home.html');
})

// logout - destroying the session
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            res.status(500).send('Internal Server Error');
        }
    });
});

app.post('/signup', async (req, res) => {
    const userRecaptchaResponse = req.body['g-recaptcha-response'];

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `secret=${RECAPTCHA_SECRET_KEY}&response=${userRecaptchaResponse}`,
    };

    try {
        const captchaVerificationResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', options);
        const verificationData = await captchaVerificationResponse.json();

        if (verificationData.success) {
            const username = req.body.txt;
            const email = req.body.email;
            const password = req.body.pswd;

            // Hash the password before storing it in the database
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Check if the email already exists in the database
            const [emailCheckResults] = await pool.execute('SELECT email FROM users WHERE email = ?', [email]);

            if (emailCheckResults.length > 0) {
                // Email already exists, handle the error
                res.redirect('/signup.html');
            } else {
                // Email is unique, proceed with the insertion
                const [insertResults] = await pool.execute('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]);

                // Assuming the insert operation was successful
                res.redirect('/login.html');
            }
        } else {
            res.redirect('/signup.html');
        }
    } catch (error) {
        // Handle errors that occurred during the request
        console.error('Error during reCAPTCHA verification or database operation:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.post('/login', async (req, res) => {
    const userRecaptchaResponse = req.body['g-recaptcha-response'];

    // Verify reCAPTCHA response
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `secret=${RECAPTCHA_SECRET_KEY}&response=${userRecaptchaResponse}`,
    };

    try {
        const captchaVerificationResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', options);
        const verificationData = await captchaVerificationResponse.json();

        if (verificationData.success) {
            const email = req.body.email;
            const password = req.body.pswd;

            // Query the database to retrieve the user based on the provided email
            const [results] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);

            if (results.length === 0) {
                // No user found with the provided email
                res.redirect('/login.html');
                return;
            }

            // User with the provided email exists, compare the hashed password
            const user = results[0]; // Assuming only one user matches the email
            const passwordMatch = await bcrypt.compare(password, user.password);

            if (passwordMatch) {
                // Passwords match, login successful
                req.session.userId = user.id;
                req.session.userName = user.username;
                req.session.email = user.email;
                res.redirect('/home.html');
            } else {
                // Passwords do not match, login failed
                res.redirect('/login.html');
            }
        } else {
            // reCAPTCHA verification failed, redirect to login page
            res.redirect('/login.html');
        }
    } catch (error) {
        // Handle errors that occurred during reCAPTCHA verification or database query
        console.error('Error during reCAPTCHA verification or database query:', error);
        res.status(500).send('Internal Server Error');
    }
});
// to check if the session is present
app.get('/api/check-session', (req, res) => {
    try {
        if (req.session.userName) {
            // Session exists, user is authenticated
            res.json({ isAuthenticated: true });
        } else {
            // Session doesn't exist, user is not authenticated
            res.json({ isAuthenticated: false });
        }
    } catch (error) {
        console.error('Error processing check-session request:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



app.get('/nav/click', (req, res) => {
    if (req.session && req.session.userName) {
        // Session exists, destroy it
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
            }
            // Redirect to home page after destroying the session
            res.redirect('/home.html');
        });
    } else {
        // Session does not exist, redirect to signup page
        res.redirect('/signup.html');
    }
});


// music player

// Define a route to handle requests for YouTube video details
app.get('/api/getYouTubeVideoDetails', async (req, res) => {
    try {
        const videoId = req.query.videoId; // Get the videoId from the query parameter

        // Fetch the audio stream URL based on the videoId 
        const audioUrl = (await fetchAudioStreamInfo(videoId)).audioUrl;
        // Fetch the title of the song based on the videoId
        const title = (await fetchAudioStreamInfo(videoId)).title;

        // Respond with JSON containing the audio URL and song title
        res.json({ audioUrl, title });

    } catch (error) {
        console.error('Error fetching YouTube audio URL:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function fetchAudioStreamInfo(videoId) {
    try {
        // Get the video info
        const info = await ytdl.getInfo(videoId);

        // Find the highest quality audio stream (in this case, the first one)
        const audioStream = ytdl.filterFormats(info.formats, 'audioonly')[0];

        // Extract the video title from the video info
        const videoTitle = info.videoDetails.title;

        // Return an object containing audio stream URL and video title
        return {
            audioUrl: audioStream.url,
            title: videoTitle
        };
    } catch (error) {
        console.error('Error fetching audio stream info:', error);
        throw error; // Rethrow the error for handling in the calling function
    }
}


app.get('/api/getYouTubeAudio', async (req, res) => {
    try {
        // Get the video ID from the query parameters
        const videoId = req.query.videoId;
        const videoURL = `https://www.youtube.com/watch?v=${videoId}`;
        const info = await ytdl.getInfo(videoURL);
        const videoTitle = info.videoDetails.title;

        // Set headers to prompt download
        res.setHeader('Content-Disposition', `attachment; filename="${videoTitle}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');

        const audioStream = ytdl(videoURL, { quality: 'highestaudio' });
        
        // Pipe the audio stream directly to the response object
        audioStream.pipe(res);

        audioStream.on('error', (err) => {
            console.error('Error downloading audio:', err);
            res.status(500).send('Internal Server Error');
        });
    } catch (error) {
        console.error('Error fetching YouTube audio:', error);
        res.status(500).send('Internal Server Error');
    }
});



app.get('/api/getYouTubeVideoUrl', async (req, res) => {
    try {
      const { songName } = req.query;
  
      // Make a request to the YouTube Data API to search for videos based on the song name
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          q: songName,
          key: YOUTUBE_API_KEY,
          part: 'snippet',
          type: 'video',
          maxResults: 1
        }
      });
      // Extract the first video ID from the API response
    const videoId = response.data.items[0].id.videoId;

    // Construct the YouTube video URL
    const youtubeVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    res.json({ youtubeVideoUrl });
  } catch (error) {
    console.error('Error fetching YouTube video URL:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// trending page content 
app.get('/api/getTrendingSongs', async (req, res) => {
    try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
            params: {
                part: 'snippet',
                chart: 'mostPopular',
                regionCode: 'IN',
                videoCategoryId: '10',
                maxResults: 30,
                key: YOUTUBE_API_KEY
            }
        });

        const videos = response.data.items;
        const trendingSongs = videos.map(video => {

            const videoId = video.id;
            const videoLink = `https://www.youtube.com/watch?v=${videoId}`;
            const imageUrl = video.snippet.thumbnails.maxres ? video.snippet.thumbnails.maxres.url : video.snippet.thumbnails.default.url;
            return {
                title: video.snippet.title,
                imageUrl: imageUrl,
                videoTitle: video.snippet.title, // Include the video title
                videoLink: videoLink,
            };
        });

        res.json(trendingSongs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/get-image-url', async (req, res) => {
    try {
        const videoURL = req.query.videoUrl;
        const info = await ytdl.getInfo(videoURL);

        if (!info || !info.player_response || !info.player_response.videoDetails || !info.player_response.videoDetails.thumbnail) {
            throw new Error('Invalid video information');
        }

        const imageURL = info.player_response.videoDetails.thumbnail.thumbnails[info.player_response.videoDetails.thumbnail.thumbnails.length - 1].url;

        res.json({ imageURL });
    } catch (error) {
        console.error('Error fetching image:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



app.get('/updateHistory', async (req, res) => {
    try {
      const userId = req.session.userId; // Assuming user ID is stored in the session
      const songLink = req.query.songLink;
  
      // Check if the song link is already present in the user's history
      const isSongPresent = await checkIfSongPresentInHistory(userId, songLink);
  
      if (isSongPresent) {
        // If the song is present, remove it from history
        await removeFromHistory(userId, songLink);
      }
  
      // Insert the new song link to the bottom of the history
      await addToHistory(userId, songLink);
  
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating history:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

async function checkIfSongPresentInHistory(userId, songLink) {
  try {
    const sql = 'SELECT * FROM history WHERE id = ? AND songlink = ?';
    const [results] = await pool.execute(sql, [userId, songLink]);

    // Check if the song link is present in the history
    const isSongPresent = results.length > 0;

    return isSongPresent;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error; // Re-throw the error to be caught by the caller
  }
}

async function addToHistory(userId, songLink) {
  try {
    const sql = 'INSERT INTO history (id, songlink) VALUES (?, ?)';
    await pool.execute(sql, [userId, songLink]);
    return; // Resolve without a value since there is no result to return
  } catch (error) {
    console.error('Error executing query:', error);
    throw error; // Re-throw the error to be caught by the caller
  }
}

  async function removeFromHistory(userId, songLink) {
  try {
    const sql = 'DELETE FROM history WHERE id = ? AND songlink = ?';
    await pool.execute(sql, [userId, songLink]);
    return; // Resolve without a value since there is no result to return
  } catch (error) {
    console.error('Error executing query:', error);
    throw error; // Re-throw the error to be caught by the caller
  }
}

// favorite button api 
// Express route to toggle the favorite status of the song
app.get('/toggleFavorite', async (req, res) => {
    try {
        userId=req.session.userId;
        const songLink = req.query.songLink;
        // Assuming toggleFavoriteStatusInDatabase returns a Promise
        let isSongPresent = await checkIfSongPresentInDatabase(req, songLink);

        // Toggle the favorite status
        if (isSongPresent) {
            // If the song is present, remove it from favorites
            await removeFromFavorites(userId, songLink);
        } else {
            // If the song is not present, add it to favorites
            await addToFavorites(userId, songLink);
        }
        
        isSongPresent=!isSongPresent;

        // Send the response as JSON
        res.json({ isSongPresent });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
async function addToFavorites(userId, songLink) {
  try {
    const sql = 'INSERT INTO favorites (id, songlink) VALUES (?, ?)';
    await pool.execute(sql, [userId, songLink]);
    return; // Resolve without a value since there is no result to return
  } catch (error) {
    console.error('Error in addToFavorites:', error);
    throw error; // Re-throw the error to be caught by the caller
  }
}
async function removeFromFavorites(userId, songLink) {
  try {
    const sql = 'DELETE FROM favorites WHERE id = ? AND songlink = ?';
    await pool.execute(sql, [userId, songLink]);
    return; // Resolve without a value since there is no result to return
  } catch (error) {
    console.error('Error in removeFromFavorites:', error);
    throw error; // Re-throw the error to be caught by the caller
  }
}



app.get('/checkSong', (req, res) => {
    const songLink = req.query.songLink;

    // Assuming you have a function to check if the song is present in the database
    checkIfSongPresentInDatabase(req, songLink)
        .then((isSongPresent) => {
            // Send the response as JSON
            // console.log(isSongPresent);
            res.json({ isSongPresent });
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        });
});

// Function to check if the song is present in the database
async function checkIfSongPresentInDatabase(req, songLink) {
  try {
    const userId = req.session.userId; // Assuming user ID is stored in the session

    // Query the favorites table with a prepared statement
    const sql = 'SELECT * FROM favorites WHERE id = ? AND songlink = ?';
    const values = [userId, songLink];

    const [results] = await pool.execute(sql, values);

    // Check if the favorite song is present for the user
    const isSongPresent = results.length > 0;

    return isSongPresent;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error; // Re-throw the error to be caught by the caller
  }
}


app.get('/api/getFavSongsInfo', async (req, res) => {
    try {
        const userId = req.session.userId; // Assuming user ID is stored in the session

        // Query the favorites table to get all song links for the user
        const sql = 'SELECT songlink FROM favorites WHERE id = ?';
        const results = await executeQuery(sql, [userId]);

        // Extract song links from the results
        const favSongLinks = results.map(result => result.songlink);

        // Fetch additional information for each favorite song from YouTube
        const favSongsInfoPromises = favSongLinks.map(async (songLink) => {
            const videoId = extractVideoId(songLink);
            const youtubeApiUrl = 'https://www.googleapis.com/youtube/v3/videos';

            const response = await axios.get(youtubeApiUrl, {
                params: {
                    part: 'snippet',
                    id: videoId,
                    key: YOUTUBE_API_KEY
                }
            });

            const video = response.data.items[0];
            const imageUrl = video.snippet.thumbnails.maxres ? video.snippet.thumbnails.maxres.url : video.snippet.thumbnails.default.url;
            return {
                title: video.snippet.title,
                imageUrl: imageUrl,
                videoTitle: video.snippet.title,
                videoLink: `https://www.youtube.com/watch?v=${videoId}`
            };
        });

        // Wait for all promises to resolve
        const favSongsInfo = await Promise.all(favSongsInfoPromises);

        // Send the list of favorite song information as the response
        res.json({ favSongsInfo });
    } catch (error) {
        console.error('Error fetching favorite songs info:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/getRecentlyPlayedSongs', async (req, res) => {
    try {
        const userId = req.session.userId; // Assuming user ID is stored in the session

        // Query the history table to get the bottom 10 recently played songs for the user
        const sql = 'SELECT songlink FROM history WHERE id = ? ORDER BY serialId DESC LIMIT 9';
        const results = await executeQuery(sql, [userId]);

        // Extract song links from the results
        const recentlyPlayedSongLinks = results.map(result => result.songlink);

        // Fetch additional information for each recently played song from YouTube
        const recentlyPlayedSongsInfoPromises = recentlyPlayedSongLinks.map(async (songLink) => {
            const videoId = extractVideoId(songLink);
            const youtubeApiUrl = 'https://www.googleapis.com/youtube/v3/videos';

            const response = await axios.get(youtubeApiUrl, {
                params: {
                    part: 'snippet',
                    id: videoId,
                    key: YOUTUBE_API_KEY
                }
            });

            const video = response.data.items[0];
            const imageUrl = video.snippet.thumbnails.maxres ? video.snippet.thumbnails.maxres.url : video.snippet.thumbnails.default.url;
            return {
                title: video.snippet.title,
                imageUrl: imageUrl,
                videoTitle: video.snippet.title,
                videoLink: `https://www.youtube.com/watch?v=${videoId}`
            };
        });

        // Wait for all promises to resolve
        const recentlyPlayedSongsInfo = await Promise.all(recentlyPlayedSongsInfoPromises);

        // Send the list of recently played song information as the response
        res.json({ recentlyPlayedSongsInfo });
    } catch (error) {
        console.error('Error fetching recently played songs info:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

function extractVideoId(youtubeUrl) {
    const match = youtubeUrl.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
}

async function executeQuery(sql, values) {
    try {
        const [results] = await pool.execute(sql, values);
        return results;
    } catch (error) {
        throw error;
    }
}


app.get('/api/getRandomLink', async (req, res) => {
    try {
      // Replace 'YOUR_YTDL_API_KEY' with your YouTube Data API key
      const trendingSongs = await getTrendingSongs();
  
      // Pick a random song from the top 30 trending songs
      const randomIndex = Math.floor(Math.random() * Math.min(30, trendingSongs.length));
      const randomSong = trendingSongs[randomIndex];
  
      res.json({ videoUrl: randomSong.url });
    } catch (error) {
      console.error('Error fetching random link:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  
  async function getTrendingSongs() {
    try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
            params: {
                part: 'snippet',
                chart: 'mostPopular',
                regionCode: 'IN',
                videoCategoryId: '10',
                maxResults: 30,
                key: YOUTUBE_API_KEY
            }
        });

        const videos = response.data.items;
        const trendingSongs = videos.map(video => {

            const videoId = video.id;
            const videoLink = `https://www.youtube.com/watch?v=${videoId}`;
            // const imageUrl = video.snippet.thumbnails.maxres ? video.snippet.thumbnails.maxres.url : video.snippet.thumbnails.default.url;
            return {
                title: video.snippet.title,
                //imageUrl: imageUrl,
                //videoTitle: video.snippet.title, // Include the video title
                url: videoLink,
            };
        });
      return trendingSongs;
    } catch (error) {
      console.error('Error fetching trending songs:', error);
      throw error;
    }
  }
  



  app.get('/checkSongRating', async (req, res) => {
    const { songLink } = req.query;
  
    // Get the user ID from the session (replace 'userId' with the actual attribute name you use)
    const userId = req.session.userId;
  
    const sql = 'SELECT rating FROM ratings WHERE songLink = ? AND id = ?';
    try {
      const [results] = await pool.execute(sql, [songLink, userId]);
  
      // If the songLink is not present, return 0 as the rating
      const rating = results.length > 0 ? results[0].rating : 0;
  
      res.json({ rating });
    } catch (error) {
      console.error('Error querying database:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  


  app.get('/toggleRate', async (req, res) => {
    const { songLink, userRating } = req.query;
  
    // Get the user ID from the session (replace 'userId' with the actual attribute name you use)
    const userId = req.session.userId;
  
    try {
      // Check if the user has already rated the song
      const [existingRating] = await pool.execute('SELECT * FROM ratings WHERE songLink = ? AND id = ?', [songLink, userId]);
  
      if (existingRating.length > 0) {
        // If the user has already rated the song, update the rating
        await pool.execute('UPDATE ratings SET rating = ? WHERE songLink = ? AND id = ?', [userRating, songLink, userId]);
      } else {
        // If the user has not rated the song yet, insert a new rating record
        await pool.execute('INSERT INTO ratings (id, songLink, rating) VALUES (?, ?, ?)', [userId, songLink, userRating]);
      }
  
      // Get the updated rating for the song
      const [updatedRating] = await pool.execute('SELECT rating FROM ratings WHERE songLink = ? AND id = ?', [songLink, userId]);
  
      res.json({ currentRating: updatedRating.length > 0 ? updatedRating[0].rating : 0 });
    } catch (error) {
      console.error('Error updating rating:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

app.listen(port, () => {
    console.log(`Music app listening on port ${port}`)
})