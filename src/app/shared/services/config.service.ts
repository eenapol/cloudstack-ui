import { Injectable, isDevMode } from '@angular/core';
import { Http } from '@angular/http';
import { SecurityGroup } from '../../security-group/sg.model';
import { Observable } from 'rxjs/Rx';

interface IConfig {
  securityGroupTemplates: Array<SecurityGroup>;
}

@Injectable()
export class ConfigService {
  private config: IConfig;

  constructor(private http: Http) { }

  public get(key: string | Array<string>): Observable<any | Array<any>> {
    let isArray = Array.isArray(key);

    if (this.config) {
      return Observable.of(this.getResult(isArray, key));
    }

    return this.load().map(() => this.getResult(isArray, key));
  }

  private getResult(isArray: boolean, key: string | Array<string>): any {
    return isArray ? this.getArrayResult(key as Array<string>) : this.config[key as string];
  }

  private getArrayResult(keyArray: Array<string>): Array<any> {
    let result = [];

    for (let key in this.config) {
      if ((this.config as Object).hasOwnProperty(key) && keyArray.includes(key)) {
        result.push(this.config[key]);
      }
    }

    return result;
  }

  private load(reload = false): Observable<any> {
    if (reload || !this.config) {
      const url = `/config-${isDevMode() ? 'dev' : 'prod'}.json`;
      return this.http.get(url)
        .map(response => {
          this.config = response.json();
        })
        .catch(() => this.handleError());
    } else {
      return Observable.of(null);
    }
  }

  private handleError(): Observable<any> {
    return Observable.throw('Unable to access config file');
  }
}
