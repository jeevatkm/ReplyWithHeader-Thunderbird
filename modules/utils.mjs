/*
 * Copyright (c) Jeevanandam M. (jeeva@myjeeva.com)
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at
 * https://github.com/jeevatkm/ReplyWithHeaderMozilla/blob/master/LICENSE
 */

// RWH Utilities Module

export function isObjectEmpty(objectName) {
    for (let prop in objectName) {
        if (objectName.hasOwnProperty(prop)) {
            return false;
        }
    }
    return true;
}

export function createDocumentFromString(htmlString) {
    return new DOMParser().parseFromString(htmlString, 'text/html')
}

export function createElementFromString(htmlString) {
    return createDocumentFromString(htmlString)?.body.firstElementChild;
}

const knownHeaderCaps = ['x', 'id', 'spf', 'dkim', 'messageid', 'arc', 'ms', 'mime', 'smtp', 'guid', 'eid'];
export function toPartialCanonicalFormat(hdrKey) {
    let values = [];
    for (let v of hdrKey.split('-')) {
        if (knownHeaderCaps.includes(v)) {
            values.push(v.toUpperCase());
        } else {
            values.push(v.charAt(0).toUpperCase() + v.slice(1));
        }
    }
    return values.join('-');
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
