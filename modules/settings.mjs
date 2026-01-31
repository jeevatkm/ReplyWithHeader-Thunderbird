/*
 * Copyright (c) Jeevanandam M. (jeeva@myjeeva.com)
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at
 * https://github.com/jeevatkm/ReplyWithHeaderMozilla/blob/master/LICENSE
 */

// RWH Settings Module

import { rwhLogger } from './logger.mjs';
import * as rwhUtils from './utils.mjs';

export const optionsPrefix = 'extensions.replywithheader.';
export const replySubjectPrefix = 'Re:';
export const forwardSubjectPrefix = 'Fwd:';
export const headerLabelSeqStyleSettings = {
    0: ['subject', 'date', 'from', 'to', 'cc', 'reply-to'], // Thunderbird
    1: ['from', 'date', 'to', 'cc', 'reply-to', 'subject'], // Outlook
    2: ['from', 'date', 'subject'],             // Simple
    3: ['from', 'to', 'cc', 'date', 'reply-to', 'subject']  // Lookout
}
export const homepageUrl = 'http://myjeeva.com/replywithheader-mozilla';
export const reviewsPageUrl = 'https://addons.mozilla.org/en-US/thunderbird/addon/replywithheader/';
export const issuesPageUrl = 'https://github.com/jeevatkm/ReplyWithHeaderMozilla/issues';
export const paypalDonateUrl = 'https://www.paypal.com/donate/?cmd=_donations&business=QWMZG74FW4QYC&lc=US&item_name=ReplyWithHeader+(RWH)+Thunderbird+Addon&currency_code=USD';
export const gitHubSponsorUrl = 'https://github.com/sponsors/jeevatkm?o=esb';

let keyHeaderLabelSeqStyle = 'header.label.seq.style';
let keyHeaderDateFormat = 'header.date.format';
let keyHeaderTimeFormat = 'header.time.format';
let keyHeaderTimeZone = 'header.date.timezone';
let keyHeaderLocale = 'header.locale';
let keyHeaderLocaleUserSelected = 'header.locale.user.selected';
let keyHeaderPlainPrefixText = 'header.plain.prefix.text';
let keyHeaderHtmlPrefixLine = 'header.html.prefix.line';
let keyHeaderHtmlPrefixLineColor = 'header.html.prefix.line.color';
let keyHeaderHtmlFontSize = 'header.html.font.size';
let keyHeaderHtmlFontSizeValue = 'header.html.font.size.value';
let keyTransSubjectPrefix = 'trans.subject.prefix';
let keyOnlyOnePrefix = 'subject.prefix.only.one';
let keyKeepOriginalSubjectPrefixLanguage = 'subject.prefix.keep.original.language';
let keyCleanBlockQuoteColor = 'clean.blockquote.color';
let keyCleanAllBlockQuoteColor = 'clean.blockquote.all.color';
let keyCleanQuoteCharGreaterThan = 'clean.quote.char.greaterthan';

let rwhDefaultSettings = {
    // Refer above constant headerLabelSeqStyleSettings
    [keyHeaderLabelSeqStyle]: 1,

    [keyHeaderLocale]: 'en-US',
    [keyHeaderLocaleUserSelected]: false,
    [keyHeaderPlainPrefixText]: true,
    [keyHeaderHtmlPrefixLine]: true,
    [keyHeaderHtmlPrefixLineColor]: '#B5C4DF',
    [keyHeaderHtmlFontSize]: false,
    [keyHeaderHtmlFontSizeValue]: '11.5pt',
    [keyTransSubjectPrefix]: true,
    [keyOnlyOnePrefix]: false,
    [keyKeepOriginalSubjectPrefixLanguage]: true,

    // Date & Time
    // 0 - Locale date format
    // 1 - International date format - UTC
    [keyHeaderDateFormat]: 0,

    // Time style
    // 0 - 12 hours AM/PM
    // 1 - 24 hours
    [keyHeaderTimeFormat]: 0,

    // Date header include timezone info
    [keyHeaderTimeZone]: true,

    [keyCleanBlockQuoteColor]: true,
    [keyCleanAllBlockQuoteColor]: false,
    [keyCleanQuoteCharGreaterThan]: true,
}

export async function get(key, fallback) {
    let fullKey = optionsPrefix + key;
    let obj = await messenger.storage.local.get(fullKey);
    rwhLogger.debug(obj);

    if (rwhUtils.isObjectEmpty(obj)) {
        return null;
    }

    let result = obj[fullKey];
    return result !== 'undefined' ? result : fallback;
}

export async function set(key, value) {
    let fullKey = optionsPrefix + key;
    rwhLogger.debug(fullKey, value);
    messenger.storage.local.set({ [fullKey]: value });
}

export async function remove(key) {
    await messenger.storage.local.remove(optionsPrefix + key);
}

export async function getInt(key) {
    let v = await get(key, rwhDefaultSettings[key]);
    return parseInt(v)
}

export async function setDefault(key, value) {
    let ev = await get(key);
    if (ev === null) {
        set(key, value);
    }
}

export async function setDefaults() {
    for (let [name, value] of Object.entries(rwhDefaultSettings)) {
        await setDefault(name, value);
    }
}

export async function setIdentityDefaults(identities) {
    for (let identity of identities) {
        await setDefault(`identity.${identity.id}.enabled`, true);
    }
}

export async function isIdentityEnabled(identityId) {
    return await get(`identity.${identityId}.enabled`, true);
}

export async function getHeaderLabelSeqStyle() {
    return await getInt(keyHeaderLabelSeqStyle);
}

export async function getHeaderDateFormat() {
    return await getInt(keyHeaderDateFormat);
}

export async function getHeaderTimeFormat() {
    return await getInt(keyHeaderTimeFormat);
}

export async function isHeaderTimeZone() {
    return await get(keyHeaderTimeZone, rwhDefaultSettings[keyHeaderTimeZone]);
}

export async function getHeaderLocale() {
    return await get(keyHeaderLocale, rwhDefaultSettings[keyHeaderLocale]);
}

export async function isHeaderLocaleUserSelected() {
    return await get(keyHeaderLocaleUserSelected, rwhDefaultSettings[keyHeaderLocaleUserSelected]);
}

export async function isHeaderPlainPrefixText() {
    return await get(keyHeaderPlainPrefixText, rwhDefaultSettings[keyHeaderPlainPrefixText]);
}

export async function isHeaderHtmlPrefixLine() {
    return await get(keyHeaderHtmlPrefixLine, rwhDefaultSettings[keyHeaderHtmlPrefixLine]);
}

export async function getHeaderHtmlPrefixLineColor() {
    return await get(keyHeaderHtmlPrefixLineColor, rwhDefaultSettings[keyHeaderHtmlPrefixLineColor]);
}

export async function isHeaderHtmlFontSize() {
    return await get(keyHeaderHtmlFontSize, rwhDefaultSettings[keyHeaderHtmlFontSize]);
}

export async function getHeaderHtmlFontSizeValue() {
    return await get(keyHeaderHtmlFontSizeValue, rwhDefaultSettings[keyHeaderHtmlFontSizeValue]);
}

export async function isTransSubjectPrefix() {
    return await get(keyTransSubjectPrefix, rwhDefaultSettings[keyTransSubjectPrefix]);
}

export async function isOnlyOnePrefix() {
    return await get(keyOnlyOnePrefix, rwhDefaultSettings[keyOnlyOnePrefix]);
}

export async function isKeepOriginalSubjectPrefixLanguage() {
    return await get(keyKeepOriginalSubjectPrefixLanguage, rwhDefaultSettings[keyKeepOriginalSubjectPrefixLanguage]);
}

export async function isCleanBlockQuoteColor() {
    return await get(keyCleanBlockQuoteColor, rwhDefaultSettings[keyCleanBlockQuoteColor]);
}

export async function isCleanAllBlockQuoteColor() {
    return await get(keyCleanAllBlockQuoteColor, rwhDefaultSettings[keyCleanAllBlockQuoteColor]);
}

export async function isCleanQuoteCharGreaterThan() {
    return await get(keyCleanQuoteCharGreaterThan, rwhDefaultSettings[keyCleanQuoteCharGreaterThan]);
}
