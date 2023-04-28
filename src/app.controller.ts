import {Controller, Get} from '@nestjs/common';
import {AppService} from './app.service';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {
    }

    @Get('start-blur-script')
    async startGrabberScript() {
        try {
            await this.appService.startBlurScript();
        } catch (error) {
            console.error(`An error occurred in runScript: ${error}`);
        }

    }

    @Get('start-moonrank-script')
    async startMoonrankrGrabberScript() {
        try {
            await this.appService.startMoonrankScript();
        } catch (error) {
            console.error(`An error occurred in startMoonrankrScript: ${error}`);
        }

    }
}
