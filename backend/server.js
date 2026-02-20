const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Traceroute = require('nodejs-traceroute');

const app = express();
app.use(cors());
app.use(express.json());

const getGeoLocation = async (ip) => {
    try {
        const response = await axios.get(`http://ip-api.com/json/${ip}`);
        if (response.data.status === 'success') {
            return {
                ip: ip,
                name: response.data.city ? `${response.data.city}, ${response.data.country}` : response.data.country,
                coords: [response.data.lat, response.data.lon],
                isp: response.data.isp || 'Unknown ISP',
                org: response.data.org || 'Unknown Org',
                as: response.data.as || 'Unknown AS'
            };
        }
        return null;
    } catch (error) {
        return null;
    }
};

app.post('/api/trace', (req, res) => {
    const targetDomain = req.body.domain || 'google.com';
    const hops = [];
    const uniqueIPs = new Set();
    
    console.log(`🚀 Starting LATENCY traceroute to: ${targetDomain}`);

    try {
        const tracer = new Traceroute();
        
        tracer.on('hop', (hop) => {
            // Check if we have a valid IP and it's not a timeout
            if (hop.ip && hop.ip !== '*' && !hop.ip.includes('Request timed out')) {
                if (!uniqueIPs.has(hop.ip)) {
                    uniqueIPs.add(hop.ip);
                    
                    // We extract the first successful RTT (Round Trip Time) value
                    const latency = hop.rtt1 || hop.rtt2 || hop.rtt3 || "N/A";
                    
                    hops.push({
                        ip: hop.ip,
                        latency: latency
                    });
                    console.log(`Hop: ${hop.ip} - Latency: ${latency}ms`);
                }
            }
        });

        tracer.on('close', async (code) => {
            const routeData = [];
            let lastCoords = ""; 

            for (const hopInfo of hops) {
                const geo = await getGeoLocation(hopInfo.ip);
                if (geo && geo.coords[0] !== 0) {
                    const currentCoords = `${geo.coords[0]},${geo.coords[1]}`;
                    
                    if (currentCoords !== lastCoords) {
                        // Merge the geo data with the latency data
                        routeData.push({ ...geo, latency: hopInfo.latency });
                        lastCoords = currentCoords; 
                    }
                }
            }
            
            res.json(routeData);
        });

        tracer.trace(targetDomain);
        
    } catch (ex) {
        res.status(500).json({ error: 'Traceroute failed' });
    }
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🔥 LATENCY Backend running on http://localhost:5000`);
});