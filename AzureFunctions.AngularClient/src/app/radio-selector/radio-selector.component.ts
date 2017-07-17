import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { Subject } from 'rxjs/Subject';
import { SelectOption } from '../shared/models/select-option';

@Component({
    selector: 'radio-selector',
    templateUrl: './radio-selector.component.html',
    styleUrls: ['./radio-selector.component.scss'],
})
export class RadioSelectorComponent<T> implements OnChanges {
    public selectedValue: T = null;
    @Input() control: FormControl;
    @Input() group: FormGroup;
    @Input() name: string;
    @Input() options: SelectOption<T>[];
    @Input() disabled: boolean;
    @Input() highlightDirty: boolean;
    @Input() public defaultValue: T;
    @Output() public value: Subject<T>;


    constructor() {
        this.value = new EventEmitter<T>();
    }


    private _setControl() {
        if (this.group && this.name) {
            this.control = <FormControl>this.group.controls[this.name];
        }
    }

    private _setControlValue(value: T, markDirtyIfChanged: boolean) {
        if (this.control) {
            if (markDirtyIfChanged && this.control.value !== value) {
                this.control.markAsDirty();
            }
            this.control.setValue(value);
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        //If control and defaultValue are modified at the same time, the value of defaultValue will be used.
        //If only one input is modifed, the value of that input will be used.

        let value = null;
        let valueChanged = false;

        if (changes['control']) {
            value = this.control ? this.control.value : null;
            valueChanged = true;
        }
        else if (changes['group'] || changes['name']) {
            this._setControl();
            value = this.control ? this.control.value : null;
            valueChanged = true;
        }

        if (changes['defaultValue']) {
            value = this.defaultValue;
            valueChanged = true;
        }

        if (valueChanged) {
            this.selectedValue = value;
            this.value.next(this.selectedValue);
        }
    }

    select(option: SelectOption<T>) {
        if (this.control ? !this.control.disabled : !this.disabled) {
            this._setControlValue(option.value, true);
            this.selectedValue = option.value;
            this.value.next(option.value);
        }
    }
}
