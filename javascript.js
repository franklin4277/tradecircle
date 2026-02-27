async function loadListings() {
    const resultsEl = document.getElementById('results');
    const tpl = document.getElementById('listing-template');
    if (!resultsEl) return;
    resultsEl.textContent = 'Loading...';
    try {
        const res = await fetch('/listings');
        if (!res.ok) { resultsEl.textContent = `Failed (${res.status})`; return; }
        const data = await res.json();
        resultsEl.innerHTML = '';
        if (!Array.isArray(data) || data.length === 0) { resultsEl.textContent = 'No listings yet.'; return; }
        data.forEach(item => {
            if (tpl && 'content' in tpl) {
                const node = tpl.content.cloneNode(true);
                const title = node.querySelector('.listing-title');
                const desc = node.querySelector('.listing-desc');
                const price = node.querySelector('.listing-price');
                const contactBtn = node.querySelector('.contact-btn');
                const img = node.querySelector('.listing-img');
                if (title) safeText(title, item.title);
                if (desc) safeText(desc, item.description);
                if (price) safeText(price, item.price ? `$${Number(item.price).toFixed(2)}` : '');
                if (contactBtn) contactBtn.addEventListener('click', () => alert('Contacting seller...'));
                if (img && item.image) img.src = item.image;
                resultsEl.appendChild(node);
            } else {
                const card = document.createElement('div');
                card.className = 'listing';
                const h4 = document.createElement('h4');
                safeText(h4, item.title);
                const p = document.createElement('p');
                safeText(p, item.description);
                card.appendChild(h4);
                card.appendChild(p);
                resultsEl.appendChild(card);
            }
        });
    } catch (err) {
        resultsEl.textContent = 'Network error. Try again.';
        console.error(err);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const user = getStoredUser();

    // Attach form handlers if forms exist on the page
    const loginForm = document.getElementById("login-form");
    if (loginForm) loginForm.addEventListener("submit", handleLogin);

    const registerForm = document.getElementById("register-form");
    if (registerForm) registerForm.addEventListener("submit", handleRegister);

    const createForm = document.getElementById("create-listing-form");
    if (createForm) createForm.addEventListener("submit", handleAddListing);

    const searchForm = document.getElementById("search-form");
    if (searchForm) searchForm.addEventListener("submit", handleSearch);

    // If on dashboard, render username if available
    const usernameEl = document.getElementById("username");
    if (usernameEl && user) {
        usernameEl.hidden = false;
        usernameEl.querySelector ? usernameEl.querySelector("strong").textContent = user.name || "User" : usernameEl.textContent = `Signed in as ${user.name || "User"}`;
    }
});

// Helpers
function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem("user"));
    } catch {
        return null;
    }
}

function setFeedback(el, message, { live = true } = {}) {
    if (!el) return;
    if (message) {
        el.hidden = false;
        el.textContent = message;
    } else {
        el.hidden = true;
        el.textContent = "";
    }
}

function safeText(node, text) {
    node.textContent = text ?? "";
}

function buildHeaders() {
    const headers = { "Content-Type": "application/json" };
    const user = getStoredUser();
    if (user && user.token) headers["Authorization"] = `Bearer ${user.token}`;
    return headers;
}

// API handlers
async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById("name");
    const email = document.getElementById("email");
    const password = document.getElementById("password");
    const confirm = document.getElementById("confirm-password");
    const err = document.getElementById("register-error");

    setFeedback(err, "");

    if (!name || !email || !password || !confirm) {
        setFeedback(err, "Form is incomplete.");
        return;
    }

    if (password.value.length < 8) {
        setFeedback(err, "Password must be at least 8 characters.");
        return;
    }

    if (password.value !== confirm.value) {
        setFeedback(err, "Passwords do not match.");
        return;
    }

    try {
        const res = await fetch("/register", {
            method: "POST",
            headers: buildHeaders(),
            body: JSON.stringify({ name: name.value.trim(), email: email.value.trim(), password: password.value })
        });

        const text = await res.text();
        if (!res.ok) {
            setFeedback(err, text || `Registration failed (${res.status})`);
            return;
        }

        // On success, direct user to login page
        setFeedback(err, "Registration successful. Redirecting to login...");
        setTimeout(() => {
            // redirect to canonical login redirect
                window.location = encodeURI("login.html");
        }, 800);
    } catch (err) {
        setFeedback(document.getElementById("register-error"), "Network error. Try again.");
        console.error(err);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("email");
    const password = document.getElementById("password");
    const err = document.getElementById("login-error");

    setFeedback(err, "");

        const user = getStoredUser();
        if (!user || !user.token) {
        return;
    }

    try {
        const res = await fetch("/login", {
            method: "POST",
            headers: buildHeaders(),
            body: JSON.stringify({ email: email.value.trim(), password: password.value })
        });

        if (!res.ok) {
        const editId = e.target.dataset.editId;
        let res;
        if (editId) {
            res = await fetch(`/listings/${editId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${user.token}` },
                body: form
            });
        } else {
            res = await fetch('/add-listing', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${user.token}` },
                body: form
            });
        }
            const txt = await res.text();
            setFeedback(err, txt || "Login failed.");
            return;
        }

        const data = await res.json();
        // expect { name, email, token, ... }
        localStorage.setItem("user", JSON.stringify(data));
        // redirect to canonical dashboard redirect
        window.location = "dashboard.html";
    } catch (err) {
            const user = getStoredUser();
            if (!user || !user.token) return alert('Not authorized');
            if (!confirm('Delete this listing?')) return;
            try {
                const res = await fetch(`/listings/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` } });
                if (!res.ok) return alert('Delete failed');
                loadListings();
            } catch (err) { console.error(err); alert('Network error'); }
        }

        function startEdit(listing) {
            const form = document.getElementById('create-listing-form');
            const title = document.getElementById('title');
            const description = document.getElementById('description');
            const price = document.getElementById('price');
            const submitBtn = document.getElementById('submit-btn');
            const cancelBtn = document.getElementById('cancel-edit');
            if (!form) return;
            form.dataset.editId = listing.id;
            title.value = listing.title || '';
            description.value = listing.description || '';
            price.value = listing.price || '';
            if (submitBtn) submitBtn.textContent = 'Save Changes';
            if (cancelBtn) { cancelBtn.hidden = false; cancelBtn.onclick = () => { form.reset(); delete form.dataset.editId; submitBtn.textContent = 'Submit Listing'; cancelBtn.hidden = true; } }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        setFeedback(err, "Network error. Try again.");
        console.error(err);
    }
}

function logout() {
    localStorage.removeItem("user");
    // redirect to canonical landing redirect
    window.location = "landing-page.html";
}
// expose logout for inline handlers in HTML
window.logout = logout;

async function handleAddListing(e) {
    e.preventDefault();
    const title = document.getElementById("title");
    const description = document.getElementById("description");
    const price = document.getElementById("price");
    const feedback = document.getElementById("create-feedback");

    setFeedback(feedback, "");

    if (!title || !description || !price) {
        setFeedback(feedback, "Please complete the form.");
        return;
    }

    try {
        const res = await fetch("/add-listing", {
            method: "POST",
            headers: buildHeaders(),
            body: JSON.stringify({
                title: title.value.trim(),
                description: description.value.trim(),
                price: parseFloat(price.value) || 0
            })
        });

        const text = await res.text();
        if (!res.ok) {
            setFeedback(feedback, text || `Failed (${res.status})`);
            return;
        }

        setFeedback(feedback, "Listing submitted.");
        e.target.reset();
    } catch (err) {
        setFeedback(feedback, "Network error. Try again.");
        console.error(err);
    }
}

async function handleSearch(e) {
    e.preventDefault();
    const q = document.getElementById("searchBox");
    const resultsEl = document.getElementById("results");
    const tpl = document.getElementById("listing-template");

    if (!q || !resultsEl) return;

    resultsEl.innerHTML = "Searching...";
    try {
        const res = await fetch("/search?q=" + encodeURIComponent(q.value.trim()));
        if (!res.ok) {
            resultsEl.textContent = `Search failed (${res.status})`;
            return;
        }

        const data = await res.json();
        resultsEl.innerHTML = "";

        if (!Array.isArray(data) || data.length === 0) {
            resultsEl.textContent = "No results found.";
            return;
        }

        // Use template when available
        data.forEach(item => {
            if (tpl && 'content' in tpl) {
                const node = tpl.content.cloneNode(true);
                const title = node.querySelector(".listing-title");
                const desc = node.querySelector(".listing-desc");
                const price = node.querySelector(".listing-price");
                const contactBtn = node.querySelector(".contact-btn");

                if (title) safeText(title, item.title);
                if (desc) safeText(desc, item.description);
                if (price) safeText(price, item.price ? `$${Number(item.price).toFixed(2)}` : "");
                if (contactBtn) contactBtn.addEventListener("click", () => { alert("Contacting seller..."); });
                // ensure image path uses forward slashes and leading '/'
                const imgEl = node.querySelector('.listing-img');
                if (imgEl) {
                    if (item.image) {
                        const src = item.image.replace(/\\/g,'/');
                        imgEl.src = src.startsWith('/') ? src : '/' + src;
                        imgEl.alt = item.title || 'Listing image';
                    } else {
                        imgEl.hidden = true;
                    }
                }

                resultsEl.appendChild(node);
            } else {
                // fallback markup
                const card = document.createElement("div");
                card.className = "listing";
                const h4 = document.createElement("h4");
                safeText(h4, item.title);
                const p = document.createElement("p");
                safeText(p, item.description);
                card.appendChild(h4);
                card.appendChild(p);
                resultsEl.appendChild(card);
            }
        });
    } catch (err) {
        resultsEl.textContent = "Network error. Try again.";
        console.error(err);
    }
}