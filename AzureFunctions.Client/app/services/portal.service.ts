﻿import {Injectable} from 'angular2/core';
import {IPortalService} from './iportal.service.ts';

@Injectable()
export class PortalService implements IPortalService {
    public resourceId = '';
    private portalSignature: string = "pcIframe";
    private initCallback: (token: string) => void;
    private refreshCallback: (token: string) => void;
    private getAppSettingCallback: (appSettingName: string, cancelled: boolean) => void;

    get inIFrame() : boolean{
        return window.parent !== window;
    }

    initializeIframe(initCallback: (token: string) => void, refreshCallback: (token: string) => void): void {
        this.initCallback = initCallback;
        this.refreshCallback = refreshCallback;

        window.addEventListener("message", this.iframeReceivedMsg.bind(this), false);
        this.postMessage("ready");

        // Temporary since portal hides the ready message from the extension.  Once we have the new App Blade,
        // it will pass it through and we can get rid of this.  Currently we're just using this to tell
        // Ibiza to resolve its onInputsSet call which stops the loading bar.
        this.postMessage("initialized");  
    }

    openBlade(name: string) : void{
        this.postMessage({
            method: 'open-' + name
        })
    }

    openCollectorBlade(name: string, getAppSettingCallback: (appSettingName: string, cancelled : boolean) => void): void {
        this.getAppSettingCallback = getAppSettingCallback;
        this.postMessage({
            method: 'open-' + name
        })
    }

    private iframeReceivedMsg(event: any): void {
        if (event.data["signature"] !== this.portalSignature) {
            return;
        }
        var data = event.data["data"];
        var methodName = !!data.method ? data.method : data;
        console.log("[iFrame] Received mesg: " + methodName);

        if (methodName === "send-resourceId") {
            this.resourceId = data.resourceId;
        }
        else if (data.method === 'send-token') {
            this.initCallback(data.token);
        }
        else if (data.method === 'send-tokenrefresh') {
            this.refreshCallback(data.token);
        }
        else if (data.method === 'send-appSettingName') {
            if(this.getAppSettingCallback){
                this.getAppSettingCallback(data.appSettingName, data.cancelled);
                this.getAppSettingCallback = null;
            }
        }
    }

    private postMessage(data : any){
        window.parent.postMessage({
            signature: this.portalSignature,
            data: data
        },
        "*" /* Wildcard until Fx adds support to pass us parent URL */);
    }
}