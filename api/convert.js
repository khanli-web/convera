const axios = require('axios');

module.exports = async (req, res) => {
    const { link, target } = req.body;

    try {
        // Step 1: Parse the link
        const { service: sourceService, id: trackId } = parseLink(link);
        if (sourceService === target) throw new Error('Source and target cannot be the same');

        // Step 2: Fetch source metadata
        const sourceMetadata = await fetchMetadata(sourceService, trackId);
        if (!sourceMetadata) throw new Error('Track not found on source service');

        // Step 3: Search target service
        const targetResults = await searchTarget(target, sourceMetadata);
        if (!targetResults?.length) throw new Error('Track not found on target service');

        // Step 4: Find best match
        const bestMatch = findBestMatch(sourceMetadata, targetResults);
        if (!bestMatch) throw new Error('No exact match found—check title, artist, or duration');

        // Step 5: Return converted URL
        const convertedUrl = generateUrl(target, bestMatch.id);
        res.json({ success: true, url: convertedUrl });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Parse link
function parseLink(link) {
    if (link.includes('open.spotify.com/track/')) {
        const match = link.match(/track\/([a-zA-Z0-9]+)/);
        return { service: 'spotify', id: match[1] };
    } else if (link.includes('open.qobuz.com/track/')) {
        const match = link.match(/track\/(\d+)/);
        return { service: 'qobuz', id: match[1] };
    }
    throw new Error('Only Spotify and Qobuz links are supported');
}

// Fetch metadata
async function fetchMetadata(service, id) {
    if (service === 'spotify') {
        const token = await getSpotifyAccessToken();
        const { data } = await axios.get(`https://api.spotify.com/v1/tracks/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        return {
            title: data.name,
            artist: data.artists[0].name,
            duration: data.duration_ms,
        };
    } else if (service === 'qobuz') {
        const { data } = await axios.get('https://www.qobuz.com/api.json/0.2/track/get', {
            params: { app_id: process.env.QOBUZ_APP_ID, track_id: id },
        });
        return {
            title: data.title,
            artist: data.performer.name,
            duration: data.duration * 1000, // Convert seconds to ms
        };
    }
}

// Search target
async function searchTarget(target, metadata) {
    const query = `${metadata.title} ${metadata.artist}`.replace(/[^a-zA-Z0-9 ]/g, '');
    if (target === 'spotify') {
        const token = await getSpotifyAccessToken();
        const { data } = await axios.get('https://api.spotify.com/v1/search', {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { q: query, type: 'track', limit: 5 },
        });
        return data.tracks.items;
    } else if (target === 'qobuz') {
        const { data } = await axios.get('https://www.qobuz.com/api.json/0.2/catalog/search', {
            params: { app_id: process.env.QOBUZ_APP_ID, query, limit: 5 },
        });
        return data.tracks.items.map(t => ({
            id: t.id,
            name: t.title,
            artists: [{ name: t.performer.name }],
            duration_ms: t.duration * 1000,
        }));
    }
}

// Match with strict accuracy
function findBestMatch(source, targets) {
    return targets.find(target => {
        const titleMatch = source.title.toLowerCase() === target.name.toLowerCase();
        const artistMatch = source.artist.toLowerCase() === target.artists[0].name.toLowerCase();
        const durationMatch = Math.abs(source.duration - target.duration_ms) < source.duration * 0.1; // 10% tolerance
        return titleMatch && artistMatch && durationMatch;
    }) || null;
}

// Generate URL
function generateUrl(service, id) {
    return service === 'spotify'
        ? `https://open.spotify.com/track/${id}`
        : `https://open.qobuz.com/track/${id}`;
}

// Spotify token
async function getSpotifyAccessToken() {
    const { data } = await axios.post('https://accounts.spotify.com/api/token', 'grant_type=client_credentials', {
        headers: {
            'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });
    return data.access_token;
}