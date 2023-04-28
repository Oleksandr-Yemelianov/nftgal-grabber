import {Inject, Injectable} from '@nestjs/common';
import puppeteer, {Browser} from 'puppeteer';
import {ClientProxy} from '@nestjs/microservices';
import * as path from 'path';

@Injectable()
export class AppService {
    private EXTENSION_METAMASK_DIR = 'extensions/metamask';
    private browserInstance: Browser | null = null;

    constructor(@Inject('NFT_MICROSERVICE') private client: ClientProxy) {
    }

    async startBlurScript() {
        try {
            const browser = await this.getBrowserInstance(true);
            const browserPage = await browser.newPage();

            await browserPage.goto(`https://blur.io/`);

            await this.sleepForSpecifiedTime(60 * 2 * 1000);

            await this.blurGrabber(browserPage)
            await this.sleepRandom()

        } catch (error) {
            console.error(`An error occurred in startScript: ${error}`);
            throw error;
        }
    }

    async startMoonrankScript() {
        try {
            const browser = await this.getBrowserInstance(false);
            const browserPage = await browser.newPage();

            await browserPage.goto('https://moonrank.app/collections');

            await this.sleepForSpecifiedTime(20 * 1000)

            const moonrankGrabber = await this.moonrankGrabber(browserPage)

            if (!moonrankGrabber) {
                await browserPage.close();

                await this.sleepForSpecifiedTime(60 * 1000)

                await this.startMoonrankScript()
            }
            await this.sleepForSpecifiedTime(20 * 1000)

            await browserPage.close();

            await this.sleepForSpecifiedTime(24 * 60 * 60 * 1000)
            await this.startMoonrankScript()

        } catch (error) {
            console.error(`An error occurred in startMoonrankScript: ${error}`);
        }
    }

    async moonrankGrabber(browserPage) {
        const chunkSize = 100;
        try {
            const collectionsListRaw = await browserPage.evaluate(() => {
                const script = Array.from(document.querySelectorAll('script'))
                    .find(el => el.innerText.includes('Alpine.store("collections",'));
                if (script) {
                    const startIndex = script.innerText.indexOf('[{');
                    const endIndex = script.innerText.indexOf('}]))') + 1;
                    const json = script.innerText.slice(startIndex, endIndex + 1);
                    return JSON.parse(json);
                }

                return [];
            });

            if (collectionsListRaw.length) {
                const filteredArray = collectionsListRaw.map(item => item.Collection);

                for (let i = 0; i < filteredArray.length; i += chunkSize) {
                    const chunk = filteredArray.slice(i, i + chunkSize);

                    await this.sleepForSpecifiedTime(5000)
                    await this.publishSendMoonrankDataEvent(chunk);

                }
                return true

            }
            return false
        } catch (e) {
            return false
        }
    }

    async blurGrabber(browserPage) {
        try {
            const collections = await this.getContractAddressList(browserPage);

            for (const contractAddress of collections) {
                await this.sleepRandom();
                const collectionData = await this.getBlurData(
                    contractAddress,
                    browserPage,
                );

                await this.sleepRandom();
                const nftsFirstPage = await this.getBlurData(
                    contractAddress,
                    browserPage,
                    true,
                    '%7B%22traits%22%3A%5B%5D%7D',
                );

                await this.publishSendBlurDataEvent({
                    collectionData: collectionData.collection,
                    nfts: nftsFirstPage.tokens,
                });

                await this.sleepRandom();
                let queryForNextPage = this.getQueryForNextNftPage(
                    nftsFirstPage.tokens[nftsFirstPage.tokens.length - 1],
                );

                let i = nftsFirstPage.totalCount;
                while (i > 0) {
                    try {
                        await this.sleepRandom();

                        const {tokens} = await this.getBlurData(
                            contractAddress,
                            browserPage,
                            true,
                            queryForNextPage,
                        );
                        if (!tokens.length) {
                            console.log('no nfts / break');
                            break;
                        }
                        queryForNextPage = this.getQueryForNextNftPage(
                            tokens[tokens.length - 1],
                        );
                        await this.publishSendBlurDataEvent({
                            collectionData: collectionData.collection,
                            nfts: tokens,
                        });

                        i -= 100;
                    } catch (error) {
                        // Skip error
                    }
                }

                await this.publishSendBlurDataEvent({
                    parsedCollectionMetadata: {
                        contractAddress,
                        name: collectionData.collection.name,
                        logoUrl: collectionData.collection.imageUrl
                    }
                })
                console.log('Parsed Contract Address: ', contractAddress)

            }
            await this.blurGrabber(browserPage)
            await this.sleepRandom
        } catch (error) {
            // Skip error
        }
    }

    async getBlurTopCollectionsOneWeekList(browserPage, query?: string) {
        const url = `https://core-api.prod.blur.io/v1/collections/?filters=${query}`;

        await browserPage.goto(url);
        const rawData = await browserPage.$('body > pre');
        const data = await (await rawData.getProperty('textContent')).jsonValue();

        return JSON.parse(data);
    }

    async getBlurData(contractAddress, browserPage, tokens = false, query?) {
        let url = `https://core-api.prod.blur.io/v1/collections/${contractAddress}`;
        if (tokens) {
            url += `/tokens?filters=${query}`;
        }

        await browserPage.goto(url);
        const rawData = await browserPage.$('body > pre');
        const data = await (await rawData.getProperty('textContent')).jsonValue();

        return JSON.parse(data);
    }

    async getContractAddressList(browserPage) {
        try {
            const contractAddresses = [];

            const firstPageData = await this.getBlurTopCollectionsOneWeekList(
                browserPage, '%7B%22sort%22%3A%22VOLUME_ONE_WEEK%22%2C%22order%22%3A%22DESC%22%7D'
            );
            const firstPage = await this.addCollectionsUntilAmountIsOne(
                firstPageData.collections,
            );

            let queryForNextPage = this.getQueryForCollectionsPage(
                firstPageData.collections[firstPageData.collections.length - 1],
            );

            await this.sleepRandom();

            if (firstPage.isEnd) {
                contractAddresses.push(...firstPage.contracts);
            } else {
                contractAddresses.push(...firstPage.contracts);
                let isLoopEnd = false;

                while (!isLoopEnd) {
                    await this.sleepRandom();
                    const collectionsData = await this.getBlurTopCollectionsOneWeekList(
                        browserPage,
                        queryForNextPage,
                    );

                    const {contracts, isEnd} =
                        await this.addCollectionsUntilAmountIsOne(collectionsData.collections);
                    queryForNextPage = this.getQueryForCollectionsPage(
                        collectionsData.collections[collectionsData.collections.length - 1],
                    );
                    contractAddresses.push(...contracts);
                    isLoopEnd = isEnd;
                }
            }

            return contractAddresses;
        } catch (error) {

            throw error;
        }
    }

    async addCollectionsUntilAmountIsOne(collections) {
        const contracts = [];
        let isEnd = false;
        for (const item of collections) {
            try {
                if (!item.volumeOneWeek || item.volumeOneWeek.amount > 1) {
                    contracts.push(item.contractAddress);
                } else {
                    isEnd = true;
                    break;
                }
            } catch (error) {
                console.error(`An error occurred in addCollectionsUntilAmountIsOne: ${error}`)
            }
        }
        return {contracts, isEnd};
    }

    getQueryForCollectionsPage(collection) {
        return encodeURIComponent(
            `{"cursor":{"contractAddress":"${collection.contractAddress}","volumeOneWeek":"${collection.volumeOneWeek.amount}"},"sort":"VOLUME_ONE_WEEK","order":"DESC"}`
        );
    }

    getQueryForNextNftPage(nft) {
        const {price, tokenId} = nft;
        const cursor = price
            ? `{"price":{"unit":"ETH","time":"${price.listedAt}","amount":"${price.amount}"},"tokenId":"${tokenId}"}`
            : `{"price":null,"tokenId":"${tokenId}"}`;
        return encodeURI(`{"cursor":${cursor},"traits":[]}`);
    }

    async publishSendBlurDataEvent(data) {
        return this.client.emit('update-nfts-with-parsed-data-eth', {data});
    }

    async publishSendMoonrankDataEvent(data) {
        return this.client.emit('update-collections-parsed-data-sol', {data});
    }

    async sleepForLogin() {
        // return new Promise((resolve) => setTimeout(resolve, 120000));
        return new Promise((resolve) => setTimeout(resolve, 20000));
    }

    async sleepForSpecifiedTime(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async sleepRandom() {
        return new Promise((resolve) =>
            setTimeout(resolve, Math.random() * (5000 - 2000) + 2000),
        );
    }

    async getBrowserInstance(metamask?: boolean): Promise<Browser> {
        if (!this.browserInstance) {
            this.browserInstance = await this.browser(metamask);
        }
        return this.browserInstance;
    }


    private async browser(metamask?: boolean): Promise<Browser> {
        if (metamask) {
            const pathToExtension = path.resolve(
                process.cwd(),
                this.EXTENSION_METAMASK_DIR,
            );
            return await puppeteer.launch({
                executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
                args: [
                    `--disable-extensions-except=${pathToExtension}`,
                    `--load-extension=${pathToExtension}`,
                ],
                headless: false,
            });
        }

        return await puppeteer.launch({
            executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
            headless: false,
        });
    }
}
