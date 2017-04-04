import { Component, OnInit, HostBinding } from '@angular/core';
import { MdlDialogService } from 'angular2-mdl';
import { TranslateService } from 'ng2-translate';

import {
  deletionMark,
  DiskOffering,
  DiskOfferingService,
  JobsNotificationService,
  NotificationService,
  Volume,
  VolumeAttachmentData,
  VolumeService
} from '../../shared';

import { SpareDriveCreationComponent } from '../spare-drive-creation/spare-drive-creation.component';
import { ListService } from '../../shared/components/list/list.service';
import { VolumeTypes } from '../../shared/models/volume.model';
import { ZoneService } from '../../shared/services/zone.service';
import { Zone } from '../../shared/models/zone.model';


export interface VolumeCreationData {
  name: string;
  zoneId: string;
  diskOfferingId: string;
  size?: number;
}

interface SpareDriveSection {
  zoneName: string;
  spareDrives: Array<Volume>;
}

@Component({
  selector: 'cs-spare-drive-page',
  templateUrl: 'spare-drive-page.component.html',
  styleUrls: ['spare-drive-page.component.scss'],
  providers: [ListService]
})
export class SpareDrivePageComponent implements OnInit {
  public selectedVolume: Volume;
  public volumes: Array<Volume>;

  public selectedZones: Array<Zone>;
  public zones: Array<Zone>;

  public sections: Array<SpareDriveSection>;

  @HostBinding('class.detail-list-container') public detailListContainer = true;

  constructor(
    private dialogService: MdlDialogService,
    private diskOfferingService: DiskOfferingService,
    private jobsNotificationService: JobsNotificationService,
    private notificationService: NotificationService,
    private listService: ListService,
    private translateService: TranslateService,
    private volumeService: VolumeService,
    private zoneService: ZoneService
  ) {}

  public ngOnInit(): void {
    this.listService.onSelected.subscribe((volume: Volume) => {
      this.selectedVolume = volume;
    });

    this.listService.onAction.subscribe(() => {
      this.showCreationDialog();
    });

    this.updateVolumeList();
    this.updateZones();
    this.updateSections();
  }

  public updateSections(): void {
    if (!this.selectedZones) {
      return;
    }

    this.sections = Zone.sortByName(this.selectedZones)
      .map(zone => {
        return {
          zoneName: zone.name,
          spareDrives: this.volumes.filter(volume => volume.zoneId === zone.id)
        };
      });
  }

  public showRemoveDialog(volume: Volume): void {
    this.translateService.get([
      'YES',
      'NO',
      'CONFIRM_DELETE_VOLUME',
      'VOLUME_DELETE_DONE',
      'VOLUME_DELETE_FAILED'
    ])
      .switchMap(translatedStrings => {
        return this.dialogService.confirm(
          translatedStrings['CONFIRM_DELETE_VOLUME'],
          translatedStrings['NO'],
          translatedStrings['YES']
        );
      })
      .onErrorResumeNext()
      .subscribe(() => this.remove(volume));
  }

  public remove(volume: Volume): void {
    this.volumeService.remove(volume.id)
      .subscribe(
        () => {
          this.volumes = this.volumes.filter(listVolume => {
            return listVolume.id !== volume.id;
          });
          if (this.selectedVolume && this.selectedVolume.id === volume.id) {
            this.listService.onDeselected.next();
          }
          this.jobsNotificationService.finish({ message: 'VOLUME_DELETE_DONE' });
        },
        error => {
          this.notificationService.error(error);
          this.jobsNotificationService.fail({ message: 'VOLUME_DELETE_FAILED' });
        }
      );
  }

  public showCreationDialog(): void {
    this.dialogService.showCustomDialog({
      component: SpareDriveCreationComponent,
      classes: 'spare-drive-creation-dialog'
    })
      .switchMap(res => res.onHide())
      .subscribe((data: any) => {
        if (!data) {
          return;
        }
        this.createVolume(data);
      }, () => {});
  }

  public createVolume(volumeCreationData: VolumeCreationData): void {
    let notificationId = this.jobsNotificationService.add('VOLUME_CREATE_IN_PROGRESS');
    this.volumeService.create(volumeCreationData)
      .subscribe(
        volume => {
          if (volume.id) {
            this.diskOfferingService.get(volume.diskOfferingId)
              .subscribe((diskOffering: DiskOffering) => {
                volume.diskOffering = diskOffering;
                this.volumes.push(volume);
              });
          }
          this.jobsNotificationService.finish({
            id: notificationId,
            message: 'VOLUME_CREATE_DONE',
          });
        },
        error => {
          // todo: CS-3168
          this.notificationService.error(error.json().createvolumeresponse.errortext);
          this.jobsNotificationService.fail({
            id: notificationId,
            message: 'VOLUME_CREATE_FAILED',
          });
        }
      );
  }

  public attach(data: VolumeAttachmentData): void {
    let notificationId = this.jobsNotificationService.add('VOLUME_ATTACH_IN_PROGRESS');
    this.volumeService.attach(data)
      .subscribe(
        volume => {
          this.volumes = this.volumes.filter(v => v.id !== volume.id);
          this.jobsNotificationService.finish({
            id: notificationId,
            message: 'VOLUME_ATTACH_DONE',
          });
        },
        error => {
          this.notificationService.error(error.json().attachvolumeresponse.errortext);
          this.jobsNotificationService.fail({
            id: notificationId,
            message: 'VOLUME_ATTACH_FAILED',
          });
        });
  }

  public updateVolume(volume: Volume): void {
    this.volumes = this.volumes.map(vol => vol.id === volume.id ? volume : vol);

    if (this.selectedVolume && this.selectedVolume.id === volume.id) {
      this.selectedVolume = volume;
    }
  }

  private updateZones(): void {
    this.zoneService.getList().subscribe(zones => {
      this.zones = zones;
    });
  }

  private updateVolumeList(): void {
    let diskOfferings: Array<DiskOffering>;

    this.diskOfferingService.getList({ type: VolumeTypes.DATADISK })
      .switchMap((offerings: Array<DiskOffering>) => {
        diskOfferings = offerings;
        return this.volumeService.getList();
      })
      .subscribe(volumes => {
        this.volumes = volumes
          .filter(volume => !volume.virtualMachineId && !volume.tags.find((tag) => tag.key === deletionMark))
          .map(volume => {
            volume.diskOffering = diskOfferings.find(offering => offering.id === volume.diskOfferingId);
            return volume;
          });
      });
  }
}
