const buttonTextSpan = document.getElementById('button-text');

fetch('http://localhost:3000/api/check-session')
    .then(response => response.json())
    .then(data => {
        if (data.isAuthenticated) {
            // If session exists, change the text content to "Logout"
            buttonTextSpan.innerText = 'Logout';
        } else {
            // If session doesn't exist, change the text content to "Sign in"
            buttonTextSpan.innerText = 'Sign Up';
        }
    })
    .catch(error => {
        // Handle errors here
        console.error('Error fetching session status:', error);
    });