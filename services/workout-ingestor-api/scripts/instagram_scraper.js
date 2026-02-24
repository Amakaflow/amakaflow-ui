#!/usr/bin/env node
/**
 * Instagram Media Scraper using GraphQL API
 * Based on: https://github.com/ahmedrangel/instagram-media-scraper
 * 
 * Usage: node instagram_scraper.js <instagram_url>
 * Outputs: JSON array of image URLs
 */

const url = process.argv[2];

if (!url) {
    console.error('Usage: node instagram_scraper.js <instagram_url>');
    process.exit(1);
}

// Extract shortcode from URL
const getId = (url) => {
    const regex = /instagram.com\/(?:[A-Za-z0-9_.]+\/)?(p|reels|reel|stories)\/([A-Za-z0-9-_]+)/;
    const match = url.match(regex);
    return match && match[2] ? match[2] : null;
};

// Get Instagram media URLs using GraphQL API
const getInstagramMediaUrls = async (url) => {
    const shortcode = getId(url);
    if (!shortcode) {
        throw new Error('Invalid Instagram URL');
    }

    // Instagram GraphQL endpoint
    const graphqlUrl = 'https://www.instagram.com/api/graphql';
    const variables = JSON.stringify({ shortcode: shortcode });
    const docId = '10015901848480474';
    const lsd = 'AVqbxe3J_YA';

    // Build request URL
    const requestUrl = `${graphqlUrl}?variables=${encodeURIComponent(variables)}&doc_id=${docId}&lsd=${lsd}`;

    // Headers
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-IG-App-ID': '936619743392459',
        'X-FB-LSD': lsd,
        'X-ASBD-ID': '129477',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        'Referer': 'https://www.instagram.com/',
        'Origin': 'https://www.instagram.com',
    };

    try {
        const response = await fetch(requestUrl, {
            method: 'POST',
            headers: headers,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const media = data?.data?.xdt_shortcode_media;

        if (!media) {
            throw new Error('No media data found in response');
        }

        const imageUrls = [];

        // Single image post - get display_resources (sorted by quality, highest last)
        const displayResources = media.display_resources || [];
        if (displayResources.length > 0) {
            // Get highest quality (last in array)
            const bestResource = displayResources[displayResources.length - 1];
            if (bestResource.src) {
                imageUrls.push(bestResource.src);
            }
        } else if (media.display_url) {
            // Fallback to display_url
            imageUrls.push(media.display_url);
        }

        // Carousel post (sidecar)
        const sidecar = media.edge_sidecar_to_children?.edges || [];
        if (sidecar.length > 0) {
            for (const edge of sidecar) {
                const node = edge.node || {};
                const nodeResources = node.display_resources || [];
                
                if (nodeResources.length > 0) {
                    // Get highest quality (last in array)
                    const bestResource = nodeResources[nodeResources.length - 1];
                    if (bestResource.src) {
                        const imgUrl = bestResource.src;
                        if (!imageUrls.includes(imgUrl)) {
                            imageUrls.push(imgUrl);
                        }
                    }
                } else if (node.display_url) {
                    const imgUrl = node.display_url;
                    if (!imageUrls.includes(imgUrl)) {
                        imageUrls.push(imgUrl);
                    }
                }
            }
        }

        return imageUrls;

    } catch (error) {
        throw new Error(`Failed to fetch Instagram media: ${error.message}`);
    }
};

// Main execution
(async () => {
    try {
        const imageUrls = await getInstagramMediaUrls(url);
        // Output as JSON array
        console.log(JSON.stringify(imageUrls));
    } catch (error) {
        console.error(JSON.stringify({ error: error.message }));
        process.exit(1);
    }
})();

