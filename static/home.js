document.addEventListener("DOMContentLoaded", function () {
    // Fetch trending songs data from the Express API
    fetch('/api/getTrendingSongs')
        .then(response => response.json())
        .then(data => {
            const trendingSongsContainer = document.getElementById('trendingSongsContainer');

            // Loop through the data and create cards dynamically
            for (let i = 0; i < data.length; i++) {
                // Create a link (a) element for each card
                const linkElement = document.createElement('a');
                linkElement.href = `/player.html?searchQuery=${encodeURIComponent(data[i].videoLink)}`; // Pass video title as a parameter
                // console.log(data[i].videoLink);

                linkElement.classList.add('card-link');

                const card = document.createElement('div');
                card.classList.add('card');

                // Assuming the API provides 'imageUrl' and 'title' properties for each song
                const imageUrl = data[i].imageUrl;
                const title = truncateTitle(data[i].title);

                // Create an image element for each card
                const imgElement = document.createElement('img');
                imgElement.src = imageUrl;
                imgElement.alt = `Song ${i + 1}`;

                // Create a title element for each card
                const titleElement = document.createElement('div');
                titleElement.classList.add('title');
                titleElement.textContent = title;

                // Append the image and title to the card
                card.appendChild(imgElement);
                card.appendChild(titleElement);

                // Append the card to the link
                linkElement.appendChild(card);

                // Append the link to the container
                trendingSongsContainer.appendChild(linkElement);
            }
        })
        .catch(error => {
            console.error('Error fetching trending songs:', error);
        });
    
        fetch('/api/check-session')
    .then(response => response.json())
    .then(data => {
        if (data.isAuthenticated) {
            // Session is present, fetch favorite songs
            fetchFavoriteSongs();
            fetchRecentSongs();
            // Check if notification has been sent today
            const today = new Date().toLocaleDateString();
            const notificationSentToday = localStorage.getItem('notificationSentDate') === today;

            if (!notificationSentToday) {
                // Check if data is present in the database
                fetch('/api/check-data')  // Replace with the actual endpoint to check for data
                    .then(dataResponse => {
                        // console.log('Data response:', dataResponse);
                        return dataResponse.json();
                    })
                    .then(databaseData => {
                        // console.log('Database data:', databaseData);
                        if (databaseData && databaseData.titles && databaseData.titles.length) {
                            // console.log('hi');
                            if (Notification.permission === "granted") {
                                notify(databaseData.titles);  // Pass data to the notify function
                                localStorage.setItem('notificationSentDate', today);
                            } else {
                                Notification.requestPermission().then(res => {
                                    // Requests permission
                                    if (res === "granted") {
                                        notify(databaseData.titles);  // Pass data to the notify function
                                        localStorage.setItem('notificationSentDate', today);
                                    } else {
                                        // console.error("Did not receive permission for notifications");
                                    }
                                });
                            }
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching data:', error);
                    });
            }
            
        }
    })
    .catch(error => {
        console.error('Error checking session:', error);
    });



    function notify(titles) {
        const notification = new Notification('Trending Update', {
            body: formatNotificationBody(titles),
            icon: 'icons8-music-120.png',
            vibration: [200, 100, 200] // Vibration pattern in milliseconds (only for supporting hardware)
        });
    
        notification.addEventListener('click', () => {
            window.open('http://localhost:3000/home.html', '_blank');
            // notification.close(); // Close the notification when clicked
        });
    }
    
    function formatNotificationBody(titles) {
        if (!titles || titles.length === 0) {
            return 'No titles available';
        }
    
        // Create a formatted list of titles with index and ellipsis
        const formattedTitles = titles.map((title, index) => {
            const truncatedTitle = truncateString(title, 30, true);
            return `${index + 1}. ${truncatedTitle}`;
        });
    
        // Join the formatted titles into a single string
        const formattedTitleString = formattedTitles.join('\n');
    
        return `${formattedTitleString}`;
    }
    
    function truncateString(str, maxLength, addEllipsis = true) {
        if (str.length <= maxLength) {
            return str;
        }
    
        const truncatedStr = str.substring(0, maxLength);
        return addEllipsis ? `${truncatedStr}...` : truncatedStr;
    }
    
        
    function fetchFavoriteSongs() {
        fetch('/api/getFavSongsInfo')
            .then(response => response.json())
            .then(data => {
                // Assuming the API response structure is { favSongsInfo: [...] }
                const favSongsInfo = data.favSongsInfo;
                const favSongsContainer = document.getElementById('favSongsContainer');

                // Loop through the data and create cards dynamically
                for (let i = 0; i < favSongsInfo.length; i++) {
                    // Create a link (a) element for each card
                    const linkElement = document.createElement('a');
                    linkElement.href = `/player.html?searchQuery=${encodeURIComponent(favSongsInfo[i].videoLink)}`;
                    linkElement.classList.add('card-link');

                    const card = document.createElement('div');
                    card.classList.add('card');

                    // Assuming the API provides 'imageUrl' and 'title' properties for each song
                    const imageUrl = favSongsInfo[i].imageUrl;
                    const title = truncateTitle(favSongsInfo[i].title);

                    // Create an image element for each card
                    const imgElement = document.createElement('img');
                    imgElement.src = imageUrl;
                    imgElement.alt = `Song ${i + 1}`;

                    // Create a title element for each card
                    const titleElement = document.createElement('div');
                    titleElement.classList.add('title');
                    titleElement.textContent = title;

                    // Append the image and title to the card
                    card.appendChild(imgElement);
                    card.appendChild(titleElement);

                    // Append the card to the link
                    linkElement.appendChild(card);

                    // Append the link to the container
                    favSongsContainer.appendChild(linkElement);
                }
            })
            .catch(error => {
                console.error('Error fetching favorite songs:', error);
            });
    }

    function fetchRecentSongs() {
        fetch('/api/getRecentlyPlayedSongs')
            .then(response => response.json())
            .then(data => {
                const recentSongsContainer = document.getElementById('recentSongsContainer');

                // Loop through the data and create cards dynamically
                for (let i = 0; i < data.recentlyPlayedSongsInfo.length; i++) {
                    // Create a link (a) element for each card
                    const linkElement = document.createElement('a');
                    linkElement.href = `/player.html?searchQuery=${encodeURIComponent(data.recentlyPlayedSongsInfo[i].videoLink)}`;
                    linkElement.classList.add('card-link');

                    const card = document.createElement('div');
                    card.classList.add('card');

                    // Assuming the API provides 'imageUrl' and 'title' properties for each song
                    const imageUrl = data.recentlyPlayedSongsInfo[i].imageUrl;
                    const title = truncateTitle(data.recentlyPlayedSongsInfo[i].title);

                    // Create an image element for each card
                    const imgElement = document.createElement('img');
                    imgElement.src = imageUrl;
                    imgElement.alt = `Song ${i + 1}`;

                    // Create a title element for each card
                    const titleElement = document.createElement('div');
                    titleElement.classList.add('title');
                    titleElement.textContent = title;

                    // Append the image and title to the card
                    card.appendChild(imgElement);
                    card.appendChild(titleElement);

                    // Append the card to the link
                    linkElement.appendChild(card);

                    // Append the link to the container
                    recentSongsContainer.appendChild(linkElement);
                }
            })
            .catch(error => {
                console.error('Error fetching recently played songs:', error);
            });
    }


});

// Function to truncate title to 2 words followed by an ellipsis
function truncateTitle(fullTitle) {
    const words = fullTitle.split(' ');
    if (words.length > 2) {
        return words.slice(0, 2).join(' ') + '...';
    }
    return fullTitle;
}


