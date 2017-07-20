import {
    Component,
    ElementRef,
    ViewChild,
    HostListener,
} from '@angular/core';
const visImaging = require('vis_imaging/src/api_synthesis');
const gifshot = require('gifshot/build/gifshot');
import { ImagingService } from '../../services/imaging.service';
import { CalibrationService } from '../../services/calibration.service';

import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import * as moment from 'moment/moment';
import 'rxjs/add/observable/forkJoin';

@Component({
    selector: 'app-imaging',
    templateUrl: './imaging.component.html',
    styleUrls: ['./imaging.component.css'],
    host: {
        '(window:resize)': 'onResize($event)'
    }
})
export class ImagingComponent {
    @ViewChild('imagingCanvas') imagingCanvas: ElementRef;

    canvasSizeModifierLandscape: number = 0.6;
    canvasSizeModifierPortrait: number = 0.8;
    // number of bins picker settings
    numBins: number = 9;
    minNumBins: number = 5;
    maxNumBins: number = 10;
    numBinsStep: number = 1;
    numBinsLabel: string = "Number of bins (2**n)";
    // number of waves settings
    waves: number = 36;
    minWaves: number = 10;
    maxWaves: number = 100;
    wavesStep: number = 5;
    wavesLabel: string = "UV-Plane Extent [wavelengths]"
    // refresh time settings
    refreshTime: number = 15;
    minRefreshTime: number = 5;
    maxRefreshTime: number = 60;
    refreshTimeStep: number = 5;
    refreshTimeLabel: string = "Refresh timer [seconds]";

    // flag to block refresh image update
    blockRefresh: boolean = false;
    // timer
    updateImageTimer: any;
    timerSubscription: any;
    // draw data
    antennaPositions: any;
    visData: any;
    calibrationData: any;
    timestamp: string = null;

    gifSrc: any[] = [];

    constructor(
        private imagingService: ImagingService,
        private calibrationService: CalibrationService
    ) { }

    ngOnInit() {
        this.setCanvasSize();
    }

    setCanvasSize() {
        let baseSize = 0;
        let viewWidth = window.innerWidth;
        let viewHeight = window.innerHeight;
        if (viewWidth >= viewHeight) {
            baseSize = viewHeight * this.canvasSizeModifierLandscape;
        } else {
            baseSize = viewWidth * this.canvasSizeModifierPortrait;
        }

        this.imagingCanvas.nativeElement.width = baseSize;
        this.imagingCanvas.nativeElement.height = baseSize;
    }

    ngAfterViewInit() {
        this.getAntennaPositions();
    }

    getAntennaPositions() {
        this.imagingService.getAntennaPositions()
            .subscribe(positions => {
                this.antennaPositions = positions;
                this.startUpdateImageTimer();
            }, err => {
                setTimeout(() => {
                    this.getAntennaPositions();
                }, 5000);
            });
    }

    ngOnDestroy() {
        if (this.timerSubscription) {
            this.timerSubscription.unsubscribe();
        }
    }

    startUpdateImageTimer() {
        this.updateImageTimer = Observable.timer(0, this.refreshTime * 1000);
        this.timerSubscription = this.updateImageTimer
            .subscribe(tick => this.onRefreshTimerTick(tick));
    }

    onRefreshTimerTick(tick) {
        if (!this.blockRefresh) {
            Observable.forkJoin([
                this.imagingService.getVis(),
                this.calibrationService.getGain(),
                this.imagingService.getTimestamp()
            ]).subscribe(result => {
                this.visData = result[0];
                this.calibrationData = result[1];
                this.timestamp = result[2];
                this.drawImage();
            }, err => {
                this.blockRefresh = false;
            });
        }
    }

    drawImage() {
        if (!this.visData || !this.antennaPositions) {
            this.blockRefresh = false;
            return;
        }
        let genImg = visImaging.gen_image(this.visData, this.antennaPositions,
            this.calibrationData, this.waves, Math.pow(2, this.numBins));

        let img = new Image();
        img.onload = () => {
            let ctx = this.imagingCanvas.nativeElement.getContext('2d');
            let widthScale = this.imagingCanvas.nativeElement.width / genImg.width;
            let heightScale = this.imagingCanvas.nativeElement.height / genImg.height;
            ctx.save();
            ctx.scale(widthScale, heightScale);
            ctx.drawImage(img, 0, 0);
            ctx.restore();
            this.blockRefresh = false;
            this.gifSrc.push(img);
        };
        img.src = genImg.toDataURL();
    }

    onNumBinsChanged(value) {
        if (value !== this.numBins) {
            this.numBins = value;
            this.blockRefresh = true;
            this.drawImage();
        }
    }

    onNumWavesChanged(value) {
        if (value !== this.waves) {
            this.waves = value;
            this.blockRefresh = true;
            this.drawImage();
        }
    }

    onRefreshTimerChanged(value) {
        if (value !== this.refreshTime) {
            this.timerSubscription.unsubscribe();
            this.refreshTime = value;
            this.startUpdateImageTimer();
        }
    }

    onSaveImageBtnClick(event) {
        let image = this.imagingCanvas.nativeElement.toDataURL("image/png");
        let downloadLink = document.createElement('a');
        downloadLink.download = this.generateImageFilename(this.timestamp);
        downloadLink.href = image;
        downloadLink.click();
    }

    onSaveGifClick(event) {
        gifshot.createGIF({ images: this.gifSrc }, (obj) => {
            if (!obj.error) {
                let image = obj.image;
                let animatedImage = document.createElement('img');
                animatedImage.width = 500;
                animatedImage.height = 500;
	            animatedImage.src = image;
		        document.body.appendChild(animatedImage);
            } else {
                console.log("Failed with: " + obj.error);
            }
        });
    }

    generateImageFilename(timestamp: string) {
        let gmtDateTime = moment.utc(timestamp);
        let localDateTime = gmtDateTime.local().format("YYYY_MM_DD_HH_mm_ss");
        return `radio_image_${localDateTime}`;
    }

    onResize(event) {
        this.setCanvasSize();
        this.drawImage();
    }
}
