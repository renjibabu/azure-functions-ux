import { Component, OnInit, OnChanges, SimpleChanges, Input } from '@angular/core';
import { FormBuilder, FormArray, FormGroup, Validators } from '@angular/forms';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { Subscription as RxSubscription } from 'rxjs/Subscription';
import { TranslateService } from '@ngx-translate/core';

import { AiService } from './../../../shared/services/ai.service';
import { PortalResources } from './../../../shared/models/portal-resources';
import { EnumEx } from './../../../shared/Utilities/enumEx';
import { DropDownElement } from './../../../shared/models/drop-down-element';
import { ConnectionStrings, ConnectionStringType } from './../../../shared/models/arm/connection-strings';
import { BusyStateComponent } from './../../../busy-state/busy-state.component';
import { TabsComponent } from './../../../tabs/tabs.component';
import { CustomFormGroup, CustomFormControl } from './../../../controls/click-to-edit/click-to-edit.component';
import { ArmObj, ArmArrayResult } from './../../../shared/models/arm/arm-obj';
import { TblItem } from './../../../controls/tbl/tbl.component';
import { CacheService } from './../../../shared/services/cache.service';
import { TreeViewInfo } from './../../../tree-view/models/tree-view-info';
import { UniqueValidator } from 'app/shared/validators/uniqueValidator';
import { RequiredValidator } from 'app/shared/validators/requiredValidator';

@Component({
  selector: 'app-settings',
  templateUrl: './app-settings.component.html',
  styleUrls: ['./app-settings.component.scss']
})
export class AppSettingsComponent implements OnInit, OnChanges {
  public Resources = PortalResources;
  public groupArray: FormArray;

  //public mainFormStream: Subject<FormGroup>;
  public resourceIdStream: Subject<string>;
  private _subscription: RxSubscription;

  private _appSettingsArm: ArmObj<any>;
  private _busyState: BusyStateComponent;
  private _busyStateKey: string;

  private _resourceId: string;
  public _mainForm: FormGroup;

  private _requiredValidator: RequiredValidator;
  private _uniqueAppSettingValidator: UniqueValidator;

  constructor(
    private _cacheService: CacheService,
    private _fb: FormBuilder,
    private _translateService: TranslateService,
    private _aiService: AiService,
    tabsComponent: TabsComponent
    ) {
      this._busyState = tabsComponent.busyState;
      this._busyState.clear.subscribe(event => this._busyStateKey = undefined);

      this.resourceIdStream = new Subject<string>();
      /*
      this.mainFormStream = new Subject<FormGroup>();

      this._subscription = 
      Observable.zip(
          this.mainFormStream,
          this.resourceIdStream,
          (g, r) => ({mainForm: g, resourceId: r})
      )
      .distinctUntilChanged()
      .switchMap(s => {
        this._resourceId = s.resourceId;
        this._mainForm = s.mainForm;
        this.setScopedBusyState();
        // Not bothering to check RBAC since this component will only be used in Standalone mode
        return this._cacheService.postArm(`${this._resourceId}/config/appSettings/list`, true)
      })
      .do(null, error => {
        this._aiService.trackEvent("/errors/app-settings", error);
        this.clearScopedBusyState();
      })
      .retry()
      .subscribe(r => {
          this.clearScopedBusyState();
          this._appSettingsArm = r.json();
          this._setupForm(this._appSettingsArm);
      });
      */

      this._subscription = 
      this.resourceIdStream
      .distinctUntilChanged()
      .switchMap(resourceId => {
        this._resourceId = resourceId;
        this.setScopedBusyState();
        // Not bothering to check RBAC since this component will only be used in Standalone mode
        return this._cacheService.postArm(`${this._resourceId}/config/appSettings/list`, true)
      })
      .do(null, error => {
        this._aiService.trackEvent("/errors/app-settings", error);
        this.clearScopedBusyState();
      })
      .retry()
      .subscribe(r => {
          this.clearScopedBusyState();
          this._appSettingsArm = r.json();
          this._setupForm(this._appSettingsArm);
      });
  }

  private _setupForm(appSettingsArm: ArmObj<any>){
    if(!appSettingsArm){
        return;
    }

    this.groupArray = this._fb.array([]);

    this._requiredValidator = new RequiredValidator(this._translateService);
    this._uniqueAppSettingValidator = new UniqueValidator(
      "name",
      this.groupArray,
      this._translateService.instant(PortalResources.validation_duplicateError));

    for(let name in appSettingsArm.properties){
      if(appSettingsArm.properties.hasOwnProperty(name)){

        this.groupArray.push(this._fb.group({
          name: [
            name,
            Validators.compose([
              this._requiredValidator.validate.bind(this._requiredValidator),
              this._uniqueAppSettingValidator.validate.bind(this._uniqueAppSettingValidator)])],
            value: [appSettingsArm.properties[name]]
        }));

      }
    }

    if(this._mainForm.contains("appSettings")){
      this._mainForm.setControl("appSettings", this.groupArray);
    }
    else{
      this._mainForm.addControl("appSettings", this.groupArray);
    }

  }

  setupForm(){
    this._setupForm(this._appSettingsArm);
  }

  @Input() set mainForm(value: FormGroup){
    this._mainForm = value;
    //this.mainFormStream.next(value);
    this._setupForm(this._appSettingsArm);
  }

  @Input() set resourceId(value : string){
    this.resourceIdStream.next(value);
  }

  ngOnChanges(changes: SimpleChanges){
    // if (changes['mainForm'] || changes['resourceId']) {
    // }
  }

  ngOnInit() {
  }

  ngOnDestroy(): void{
    this._subscription.unsubscribe();
  }

  validate(){
    let appSettingGroups = this.groupArray.controls;
    appSettingGroups.forEach(group => {
      let controls = (<FormGroup>group).controls;
      for(let controlName in controls){
        let control = <CustomFormControl>controls[controlName];
        control._msRunValidation = true;
        control.updateValueAndValidity();
      }
    });
  }

  save() : Observable<boolean>{
    let appSettingGroups = this.groupArray.controls;

    if(this._mainForm.valid){
      let appSettingsArm: ArmObj<any> = JSON.parse(JSON.stringify(this._appSettingsArm));
      delete appSettingsArm.properties;
      appSettingsArm.properties = {};

      for(let i = 0; i < appSettingGroups.length; i++){
        appSettingsArm.properties[appSettingGroups[i].value.name] = appSettingGroups[i].value.value;
      }

      return this._cacheService.putArm(`${this._resourceId}/config/appSettings`, null, appSettingsArm)
      .map(appSettingsResponse => {
        this._appSettingsArm = appSettingsResponse.json();
        return Observable.of(true);
      })
      .catch(error => {
        return Observable.of(false);
      });
    }
    else{
      return(Observable.of(false));
    }
  }

  //discard(){
  //  this.groupArray.reset();
  //  this._setupForm(this._appSettingsArm);
  //}

  deleteAppSetting(group: FormGroup){
    let appSettings = this.groupArray;
    this._deleteRow(group, appSettings);
    appSettings.updateValueAndValidity();
  }

  private _deleteRow(group: FormGroup, formArray: FormArray){
    let index = formArray.controls.indexOf(group);
    if (index >= 0){
      formArray.controls.splice(index, 1);
      group.markAsDirty();
    }
  }

  addAppSetting(){
    let appSettings = this.groupArray;
    let group = this._fb.group({
        name: [
          null,
          Validators.compose([
            this._requiredValidator.validate.bind(this._requiredValidator),
            this._uniqueAppSettingValidator.validate.bind(this._uniqueAppSettingValidator)])],
        value: [null]
      });

    (<CustomFormGroup>group)._msStartInEditMode = true;
    appSettings.push(group);
    this._mainForm.markAsDirty();
  }


  private setScopedBusyState(){
    this._busyStateKey = this._busyState.setScopedBusyState(this._busyStateKey);
  }

  private clearScopedBusyState(){
    this._busyState.clearScopedBusyState(this._busyStateKey);
    this._busyStateKey = undefined;
  }

/*
  private setScopedBusyState(){
    this._setScopedBusyState(this._busyStateKey, this._busyState);
  }

  private clearScopedBusyState(){
    this._clearScopedBusyState(this._busyStateKey, this._busyState);
  }

  private _setScopedBusyState(busyStateKey: string, busyState: BusyStateComponent){
    busyStateKey = busyState.setScopedBusyState(busyStateKey);
  }

  private _clearScopedBusyState(busyStateKey: string, busyState: BusyStateComponent){
    busyState.clearScopedBusyState(busyStateKey);
    busyStateKey = undefined;
  }
*/
}