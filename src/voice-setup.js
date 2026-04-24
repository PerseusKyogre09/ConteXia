document.getElementById('grant').onclick = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        document.getElementById('grant').style.display = 'none';
        document.getElementById('status').style.display = 'block';
        setTimeout(() => window.close(), 2000);
    } catch (err) {
        alert('Permission denied. Please check your browser settings.');
    }
};
