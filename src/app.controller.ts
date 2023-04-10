import {Controller, Get} from '@nestjs/common';
import {AppService} from './app.service';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {
    }

    @Get('start-script')
    async startGrabberScript() {
        try {
            await this.appService.startScript();
        } catch (error) {
            console.error(`An error occurred in runScript: ${error}`);
        }

    }
}
