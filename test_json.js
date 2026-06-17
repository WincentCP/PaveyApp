async function testReverse() {
    const lat = -6.3024;
    const lon = 106.6522;
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    try {
        const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'PaveyApp/1.0' } });
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Text:', text.substring(0, 1000));
    } catch (e) {
        console.error(e);
    }
}
testReverse();
