import {Inject, Injectable} from '@nestjs/common';
import puppeteer from 'puppeteer';
import {ClientProxy} from '@nestjs/microservices';
import * as path from 'path';

@Injectable()
export class AppService {
    private EXTENSION_METAMASK_DIR = 'extensions/metamask';

    constructor(@Inject('NFT_MICROSERVICE') private client: ClientProxy) {
    }

    async startScript() {
        const pathToExtension = path.resolve(
            process.cwd(),
            this.EXTENSION_METAMASK_DIR,
        );
        const browser = await puppeteer.launch({
            args: [
                `--disable-extensions-except=${pathToExtension}`,
                `--load-extension=${pathToExtension}`,
            ],
            headless: false,
        });
        try {
            const browserPage = await browser.newPage();
            await browserPage.goto(`https://blur.io/`);


            await this.sleepForLogin();
            const collections = await this.getContractAddressList(browserPage);

            for (const contractAddress of collections) {
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

                await this.publishSendDataEvent({
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
                        await this.publishSendDataEvent({
                            collectionData: collectionData.collection,
                            nfts: tokens,
                        });

                        i -= 100;
                    } catch (error) {
                        // Skip error
                    }
                }
            }

            await this.sleepRandom()
            await this.startScript()
        } catch (error) {
            console.error(`An error occurred in startScript: ${error}`);
            throw error;
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

    async publishSendDataEvent(data) {
        return this.client.emit('update-nfts-with-parsed-data-eth', {data});
    }

    async sleepForLogin() {
        return new Promise((resolve) => setTimeout(resolve, 120000));
    }

    async sleepRandom() {
        return new Promise((resolve) =>
            setTimeout(resolve, Math.random() * (5000 - 2000) + 2000),
        );
    }
}
