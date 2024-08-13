
// Check for nickname in local storage
if (!localStorage.getItem('nickname') || localStorage.getItem('nickname') === '') {
    const nickname = prompt('Please enter a username:');
    localStorage.setItem('nickname', nickname);
    // Send nickname to server
    axios.post('/api/user', { nickname: nickname });
}

function goToHome() {
    axios.get('/api/images/random?count=9')
        .then(response => {
            const content = document.getElementById('content');
            content.innerHTML = '<div class="image-grid"></div>';
            const grid = content.querySelector('.image-grid');
            response.data.forEach(image => {
                const img = document.createElement('img');
                img.src = image.url;
                img.alt = image.name;
                img.onclick = () => viewImage(image.id);
                grid.appendChild(img);
            });
        })
        .catch(error => console.error('Error fetching random images:', error));
}

function goToSearch() {
    const content = document.getElementById('content');
    content.innerHTML = `
                <input type="text" id="searchInput" placeholder="Search for a person">
                <button onclick="performSearch()">Search</button>
                <div class="search-results"></div>
            `;
}

function viewRandomImage() {
    const content = document.getElementById('content');
    content.innerHTML = '<div id="imageViewer"><canvas width="512" height="512"></canvas></div>';
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = function () {
        ctx.drawImage(img, 0, 0, 512, 512);
    };
    img.src = `/api/placeholder/512/512?text=RandomImage`;

    let scale = 1;
    let translateX = 0;
    let translateY = 0;

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoom = e.deltaY > 0 ? 0.9 : 1.1;
        scale *= zoom;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-canvas.width / 2 + translateX, -canvas.height / 2 + translateY);
        ctx.drawImage(img, 0, 0, 512, 512);
        ctx.restore();
    });

    let isDragging = false;
    let lastX, lastY;

    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaX = e.clientX - lastX;
            const deltaY = e.clientY - lastY;
            translateX += deltaX / scale;
            translateY += deltaY / scale;
            lastX = e.clientX;
            lastY = e.clientY;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(scale, scale);
            ctx.translate(-canvas.width / 2 + translateX, -canvas.height / 2 + translateY);
            ctx.drawImage(img, 0, 0, 512, 512);
            ctx.restore();
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

function performSearch() {
    const searchTerm = document.getElementById('searchInput').value;
    let nickname = localStorage.getItem('nickname')
    console.log(nickname)
    axios.post('/api/search', { term: searchTerm, userId: nickname })
        .then(() => {
            return axios.get(`/api/images/search?term=${searchTerm}`);
        })
        .then(response => {
            const results = document.querySelector('.search-results');
            results.innerHTML = '';
            response.data.forEach(image => {
                const a = document.createElement('a');
                a.href = `#slideshow?person=${image.name}&id=${image.id}`;
                const img = document.createElement('img');
                img.src = image.url;
                img.alt = image.name;
                img.style.filter = 'blur(5px)';
                a.appendChild(img);
                a.appendChild(document.createTextNode(image.name));
                a.onclick = (e) => {
                    e.preventDefault();
                    startSlideshow(image.name);
                };
                results.appendChild(a);
            });
        })
        .catch(error => console.error('Error performing search:', error));
}

// Add this to the app object in your main JavaScript file

// async function performSearch() {
//     const searchTerm = $('#searchInput').value;
//     if (!searchTerm.trim()) {
//         alert('Please enter a search term');
//         return;
//     }

//     try {
//         // Show loading indicator
//         $('.search-results').innerHTML = '<p>Loading...</p>';

//         // Record the search
//         await api.post('/api/search', { term: searchTerm });

//         // Fetch search results
//         const response = await api.get(`/api/images/search?term=${encodeURIComponent(searchTerm)}`);

//         // Render results
//         this.renderSearchResults(response.data);
//     } catch (error) {
//         console.error('Error performing search:', error);
//         $('.search-results').innerHTML = '<p>An error occurred while searching. Please try again.</p>';
//     }
// }

// function renderSearchResults(images) {
//     const results = $('.search-results');
//     if (images.length === 0) {
//         results.innerHTML = '<p>No results found</p>';
//         return;
//     }

//     results.innerHTML = '';
//     images.forEach(image => {
//         const a = document.createElement('a');
//         a.href = `#slideshow?person=${encodeURIComponent(image.name)}&id=${image.id}`;

//         const img = document.createElement('img');
//         img.src = image.url;
//         img.alt = image.name;
//         img.style.filter = 'blur(5px)';

//         a.appendChild(img);
//         a.appendChild(document.createTextNode(image.name));

//         a.onclick = (e) => {
//             e.preventDefault();
//             this.startSlideshow(image.name);
//         };

//         results.appendChild(a);
//     });
// }

function viewImage(imageId) {
    axios.get(`/api/image/${imageId}`)
        .then(response => {
            const image = response.data;
            const content = document.getElementById('content');
            content.innerHTML = `
                        <div id="imageViewer">
                            <canvas width="512" height="512"></canvas>
                            <div class="image-info">
                                <h2>${image.name}</h2>
                                <p>Views: <span id="viewCount">${image.views}</span></p>
                                <div class="image-actions">
                                    <button onclick="likeImage(${image.id})">Like (${image.likes})</button>
                                    <button onclick="dislikeImage(${image.id})">Dislike (${image.dislikes})</button>
                                    <button onclick="shareImage()">Share</button>
                                </div>
                            </div>
                            <div id="commentSection">
                                <textarea id="commentInput" placeholder="Leave a comment"></textarea>
                                <button onclick="submitComment(${image.id})">Submit Comment</button>
                                <div id="comments"></div>
                            </div>
                        </div>
                    `;
            const canvas = document.querySelector('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = function () {
                ctx.drawImage(img, 0, 0, 512, 512);
            };
            img.src = image.url;

            // Implement zoom and pan functionality here (same as before)

            // Load comments
            loadComments(image.id);
        })
        .catch(error => console.error('Error viewing image:', error));
}

function startSlideshow(person) {
    axios.get(`/api/images/person/${person}`)
        .then(response => {
            const images = response.data;
            let currentIndex = 0;
            const content = document.getElementById('content');
            content.innerHTML = `
                        <div id="slideshow">
                            <div id="imageViewer">
                                <canvas width="512" height="512"></canvas>
                            </div>
                            <div class="slideshow-controls">
                                <button onclick="previousImage()">Previous</button>
                                <button onclick="nextImage()">Next</button>
                            </div>
                        </div>
                    `;

            function showImage(index) {
                const image = images[index];
                viewImage(image.id);
            }

            window.previousImage = () => {
                currentIndex = (currentIndex - 1 + images.length) % images.length;
                showImage(currentIndex);
            };

            window.nextImage = () => {
                currentIndex = (currentIndex + 1) % images.length;
                showImage(currentIndex);
            };

            showImage(currentIndex);
        })
        .catch(error => console.error('Error starting slideshow:', error));
}

function likeImage(imageId) {
    axios.post(`/api/image/${imageId}/like`)
        .then(response => {
            document.querySelector('button:contains("Like")').textContent = `Like (${response.data.likes})`;
        })
        .catch(error => console.error('Error liking image:', error));
}

function dislikeImage(imageId) {
    axios.post(`/api/image/${imageId}/dislike`)
        .then(response => {
            document.querySelector('button:contains("Dislike")').textContent = `Dislike (${response.data.dislikes})`;
        })
        .catch(error => console.error('Error disliking image:', error));
}

function shareImage() {
    const link = window.location.href;
    prompt('Copy this link to share:', link);
}

function submitComment(imageId) {
    const comment = document.getElementById('commentInput').value;
    axios.post(`/api/image/${imageId}/comment`, { comment })
        .then(() => {
            document.getElementById('commentInput').value = '';
            loadComments(imageId);
        })
        .catch(error => console.error('Error submitting comment:', error));
}

function loadComments(imageId) {
    axios.get(`/api/image/${imageId}/comments`)
        .then(response => {
            const commentsDiv = document.getElementById('comments');
            commentsDiv.innerHTML = response.data.map(comment => `
                        <div class="comment">
                            <p><strong>${comment.nickname}:</strong> ${comment.comment}</p>
                        </div>
                    `).join('');
        })
        .catch(error => console.error('Error loading comments:', error));
}

// Initial load
goToHome();
