document.getElementById('convertForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const link = document.getElementById('link').value.trim();
    const target = document.getElementById('target').value;
    const resultDiv = document.getElementById('result');
    
    resultDiv.innerHTML = 'Converting...';
    
    try {
        const response = await fetch('/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ link, target }),
        });
        const data = await response.json();
        
        if (data.success) {
            resultDiv.innerHTML = `
                <p>Converted to ${target.charAt(0).toUpperCase() + target.slice(1)}:</p>
                <a href="${data.url}" target="_blank">${data.url}</a>
                <br><button onclick="navigator.share({ url: '${data.url}' })">Share</button>
            `;
        } else {
            resultDiv.innerHTML = `Error: ${data.message}`;
        }
    } catch (error) {
        resultDiv.innerHTML = 'Error: Couldn’t connect. Try again.';
    }
});

// Auto-paste from clipboard on focus
document.getElementById('link').addEventListener('focus', async () => {
    if (navigator.clipboard) {
        try {
            const text = await navigator.clipboard.readText();
            if (text && text.startsWith('http')) {
                document.getElementById('link').value = text;
            }
        } catch (err) {
            console.log('Clipboard access denied');
        }
    }
});