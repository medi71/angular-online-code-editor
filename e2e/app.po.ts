import { browser, by, element } from 'protractor';

export class AppPage {
  navigateTo() {
    return browser.get('/bla');
  }

  getParagraphText() {
    return element(by.css('h1')).getText();
  }
}
