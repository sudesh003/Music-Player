
const urlParams = new URLSearchParams(window.location.search);
const searchQuery = urlParams.get('searchQuery');

let audioPlayer; // Variable to store the audio element
let isPlaying = false;
let youtubeVideoUrl = '';

async function starting() {
  try {
    youtubeVideoUrl = searchQuery;

    // Check if audioPlayer exists, if so, stop and reset it
    if (audioPlayer) {
      if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
      }
      audioPlayer.currentTime = 0;
      audioPlayer = null;
    }
    // Call toggleYouTubeAudio to play the new song
    toggleYouTubeAudio();
  } catch (error) {
    console.error('Error fetching YouTube video:', error);
  }

}
starting();

async function toggleYouTubeAudio() {
  try {
    // Create an audio element if it doesn't exist
    if (!audioPlayer) {
      audioPlayer = new Audio();

      // Extract the video ID from the YouTube URL
      const videoId = extractVideoId(youtubeVideoUrl);

      // Fetch the video details, including audio stream URL, using the YouTube Data API
      const response = await fetch(`/api/getYouTubeVideoDetails?videoId=${videoId}`);
      const data = await response.json();

      // Extract the audio stream URL
      const audioUrl = data.audioUrl;
      let songTitle = data.title;

      songTitle = songTitle.replace(/\.[^/.]+$/, "").replace(/video/gi, "audio");
      songTitle = sanitizeFilename(songTitle);

      const ellipsis = '...';
      const maxCharacters = 60; // Maximum characters to display before truncating

      if (songTitle.length > maxCharacters) {
        songTitle = songTitle.substring(0, maxCharacters) + ellipsis;
      }

      // Set the title of the song
      const songTitleElement = document.getElementById('songtitleId');
      songTitleElement.textContent = songTitle;

      // Set the src attribute of the audio player to the audio stream URL
      audioPlayer.src = audioUrl;

      // Load the audio (but do not play)
      audioPlayer.load();
    }

    if (isPlaying) {
      // Pause the audio
      audioPlayer.pause();
      document.getElementById('toggleButton').innerHTML = '<i class="fas fa-play"></i>';
    } else {
      // Play the audio
      audioPlayer.play();
      document.getElementById('toggleButton').innerHTML = '<i class="fas fa-pause"></i>';
    }

    // Toggle the play/pause state
    isPlaying = !isPlaying;

    // Update the timing display and slider
    updateTimingDisplay();

    audioPlayer.addEventListener('timeupdate', updateTimingDisplay);

  } catch (error) {
    console.error('Error fetching and playing YouTube audio:', error);
  }
}

function seekAudio() {
  const seekSlider = document.getElementById('seekSlider');
  audioPlayer.currentTime = audioPlayer.duration * (seekSlider.value / 100);
  updateTimingDisplay();
}

function updateTimingDisplay() {
  const timingDisplay = document.getElementById('timing');
  const seekSlider = document.getElementById('seekSlider');
  const currentTime = formatTime(audioPlayer.currentTime);
  const duration = formatTime(audioPlayer.duration);
  timingDisplay.textContent = `${currentTime} / ${duration}`;
  seekSlider.value = (audioPlayer.currentTime / audioPlayer.duration) * 100;
}

// Function to format time in MM:SS format
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  seconds = Math.floor(seconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function extractVideoId(url) {
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
  return match && match[1];
}

async function downloadAudio() {
  try {
    // Extract the video ID from the YouTube URL
    const videoId = extractVideoId(youtubeVideoUrl);
    const response = await fetch(`/api/getYouTubeAudio?videoId=${videoId}`);
    const blob = await response.blob(); // Get the audio data as a Blob

    // Create a URL for the blob and create an anchor element to trigger the download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Set the download attribute to the video title with .mp3 extension
    const contentDisposition = response.headers.get('content-disposition');
    const fileNameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
    const matches = fileNameRegex.exec(contentDisposition);
    let videoTitle = 'audio'; // Default title
    if (matches && matches[1]) {
      videoTitle = matches[1].replace(/['"]/g, ''); // Extract the filename from content-disposition header
      // Remove the file extension if present and replace "video" with "song" in the title
      videoTitle = videoTitle.replace(/\.[^/.]+$/, "").replace(/video/gi, "audio");
      videoTitle = sanitizeFilename(videoTitle);
    }
    a.download = `${videoTitle}.mp3`;

    document.body.appendChild(a);
    a.click();

    // Clean up the URL object and anchor element
    window.URL.revokeObjectURL(url);
    a.remove();
  } catch (error) {
    console.error('Error fetching YouTube audio:', error);
  }
}

const sanitizeFilename = (filename) => {
  // Remove invalid characters from the filename
  return filename.replace(/[\/?<>\\:*|""]/g, '');
};
// image for the song


// Fetch the video URL from the Express backend API
fetch(`/api/getYouTubeVideoUrl?songName=${encodeURIComponent(searchQuery)}`)
  .then(response => response.json())
  .then(data => {
    const videoUrl = data.youtubeVideoUrl;

    // Fetch the image URL from the Express backend, including the video URL as a query parameter
    return fetch(`/get-image-url?videoUrl=${encodeURIComponent(videoUrl)}`);
  })
  .then(response => response.json())
  .then(data => {
    // Assuming the response contains an 'imageURL' property
    const imageURL = data.imageURL;

    // Create an image element
    const imageElement = document.createElement("img");

    // Set the 'src' attribute of the image element to the backend URL
    imageElement.src = imageURL;

    // Set the 'alt' attribute (provide a meaningful description if possible)
    imageElement.alt = "song pic";


    // Get the container element by its id
    const imageContainer = document.getElementById("image-container");

    // Append the image element to the container
    imageContainer.appendChild(imageElement);
  })
  .catch(error => {
    console.error('Error fetching data:', error);
  });


// // fav button
function makeSongFav() {
  // Check if the session is present
  fetch('/api/check-session')
    .then(response => response.json())
    .then(data => {
      if (data.isAuthenticated) {
        // Session is present, proceed to toggle favorite status
        toggleFavorite();
      } else {
        // Session is not present, redirect to the signup page
        window.location.href = '/signup.html'; // Adjust the URL as needed
      }
    })
    .catch(error => console.error('Error checking session:', error));
}

function toggleFavorite() {
  // Assuming songLink is defined somewhere in your code
  const songLink = searchQuery;

  // Make a request to the Express backend to toggle favorite status
  fetch(`/toggleFavorite?songLink=${encodeURIComponent(songLink)}`)
    .then(response => response.json())
    .then(data => {
      // Change heart color based on the response
      const heartIcon = document.getElementById("favButton");
      if (data.isSongPresent) {
        heartIcon.style.color = "red"; // Song is present (now a favorite)
      } else {
        heartIcon.style.color = "white"; // Song is not present (not a favorite)
      }
    })
    .catch(error => console.error('Error:', error));
}



document.addEventListener('DOMContentLoaded', () => {



  // Check if the session is present
  fetch('/api/check-session')
    .then(response => response.json())
    .then(data => {
      if (data.isAuthenticated) {
        // Session is present, proceed to check the song
        checkSongFav();
        updateHistory(searchQuery);
        checkSongRating();
      }
    })
    .catch(error => console.error('Error checking session:', error));
});

function updateHistory(songLink) {
  fetch(`/updateHistory?songLink=${encodeURIComponent(songLink)}`)
    .then(response => response.json())
    .then(data => {
      // Log success or handle the response as needed
      //console.log('History updated:', data);
    })
    .catch(error => console.error('Error updating history:', error));
}

function checkSongFav() {
  // Assuming songLink is defined somewhere in your code
  const songLink = searchQuery;

  // Make a request to the Express backend
  fetch(`/checkSong?songLink=${encodeURIComponent(songLink)}`)
    .then(response => response.json())
    .then(data => {
      // Change heart color based on the response
      const heartIcon = document.getElementById("favButton");
      if (data.isSongPresent) {
        heartIcon.style.color = "red"; // Song is present
      } else {
        heartIcon.style.color = "white"; // Song is not present
      }
    })
    .catch(error => console.error('Error:', error));
}



async function moveToRandom() {
  try {
    // Call your backend API to fetch the next video link
    const response = await fetch('/api/getRandomLink');
    const data = await response.json();

    // Assuming your API returns the next video link in the 'videoUrl' property
    const nextVideoUrl = data.videoUrl;

    // Redirect to player.html with the new video link
    window.location.href = `player.html?searchQuery=${encodeURIComponent(nextVideoUrl)}`;
  } catch (error) {
    console.error('Error fetching next video:', error);
    // Handle the error appropriately, e.g., show an error message to the user
  }
}


function checkSongRating() {
  // Assuming songLink is defined somewhere in your code
  const songLink = searchQuery;

  // Make a request to the Express backend
  fetch(`/checkSongRating?songLink=${encodeURIComponent(songLink)}`)
    .then(response => response.json())
    .then(data => {
      const rating = data.rating;
      // Reset all stars to default color
      const stars = document.querySelectorAll(".rate input");
      stars.forEach(star => (star.nextElementSibling.style.color = "#ccc"));

      // Set the color of stars based on the rating
      for (let i = 5; i >= 1; i--) {
        const starElement = document.getElementById(`star${i}`);
        if (i <= rating) {
          starElement.nextElementSibling.style.color = "gold"; // Set to your desired color
        }
      }

    })
    .catch(error => console.error('Error:', error));
}


function makeSongRating(userRating) {
  // Check if the session is present
  fetch('/api/check-session')
    .then(response => response.json())
    .then(data => {
      if (data.isAuthenticated) {
        // Session is present, proceed to toggle favorite status
        toggleRate(userRating); // Assuming you want to toggle the rate immediately upon checking session
      } else {
        // Session is not present, redirect to the signup page
        window.location.href = '/signup.html'; // Adjust the URL as needed
      }
    })
    .catch(error => console.error('Error checking session:', error));
}

function toggleRate(userRating) {
  // Assuming songLink is defined somewhere in your code
  const songLink = searchQuery;

  // Make a request to the Express backend to toggle favorite status
  fetch(`/toggleRate?songLink=${encodeURIComponent(songLink)}&userRating=${userRating}`)
    .then(response => response.json())
    .then(data => {
      const rating = data.currentRating; // Assuming the backend returns the current rating after toggling
      // Reset all stars to default color
      const stars = document.querySelectorAll(".rate input");
      stars.forEach(star => (star.nextElementSibling.style.color = "#ccc"));

      // Set the color of stars based on the rating
      for (let i = 5; i >= 1; i--) {
        const starElement = document.getElementById(`star${i}`);
        if (i <= rating) {
          starElement.nextElementSibling.style.color = "gold"; // Set to your desired color
        }
      }
    })
    .catch(error => console.error('Error:', error));
}
