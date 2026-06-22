const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createLibraryCatalogClient,
    RYUU_IMAGE_URL_TEMPLATE,
    fallbackCoverForAppId
} = require('../src/main/library/library-catalog-client');

test('uses capsule_image first, then header_image, then the ryuu fallback image', async () => {
    const client = createLibraryCatalogClient({
        axios: {
            get: async () => ({
                data: [
                    {
                        appid: 10,
                        name: 'Capsule Game',
                        capsule_image: 'https://example.com/capsule-10.jpg',
                        header_image: 'https://example.com/header-10.jpg'
                    },
                    {
                        appid: 20,
                        name: 'Header Game',
                        header_image: 'https://example.com/header-20.jpg'
                    },
                    {
                        appid: 30,
                        name: 'Fallback Game'
                    }
                ]
            })
        }
    });

    const result = await client.download();

    assert.equal(result.games['10'].coverUrl, 'https://example.com/capsule-10.jpg');
    assert.equal(result.games['10'].coverSource, 'capsule_image');

    assert.equal(result.games['20'].coverUrl, 'https://example.com/header-20.jpg');
    assert.equal(result.games['20'].coverSource, 'header_image');

    assert.equal(result.games['30'].coverUrl, RYUU_IMAGE_URL_TEMPLATE.replace('{appid}', '30'));
    assert.equal(result.games['30'].coverSource, 'ryuu_image');
});

test('builds the ryuu fallback image url for numeric app ids', () => {
    assert.equal(
        fallbackCoverForAppId('1736800'),
        'https://generator.ryuu.lol/files/images/1736800.jpg'
    );
    assert.equal(fallbackCoverForAppId('abc'), null);
});
