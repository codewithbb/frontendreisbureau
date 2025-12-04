// session.js
// Small helper for checking the current login session from any page.

// Change this if the backend runs on a different host/port.
const JULIAN_API_BASE = "http://127.0.0.1:5001";

async function getCurrentSession() {
    /**
     * Calls GET /julian/session with cookies.
     *
     * Returns a normalized object:
     *   { loggedIn: true,  user: { user_id, username, full_name } }
     *   { loggedIn: false, user: null }
     */
    try {
        const resp = await fetch(`${JULIAN_API_BASE}/julian/session`, {
            method: "GET",
            credentials: "include",   // <- send the Flask session cookie
        });

        if (!resp.ok) {
            console.error("Session check non-OK:", resp.status);
            return { loggedIn: false, user: null };
        }

        const data = await resp.json();
        if (data.logged_in && data.user) {
            return {
                loggedIn: true,
                user: data.user
            };
        }

        return { loggedIn: false, user: null };
    } catch (err) {
        console.error("Session check failed:", err);
        return { loggedIn: false, user: null };
    }
}

// Expose function globally (in case this file is loaded with a normal <script> tag)
window.getCurrentSession = getCurrentSession;