/*
 * Copyright (c) Jeevanandam M. (jeeva@myjeeva.com)
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at
 * https://github.com/jeevatkm/ReplyWithHeaderMozilla/blob/master/LICENSE
 */

// RWH Notification Module

export async function show(msg) {
    messenger.notifications.create({
        'type': 'basic',
        'iconUrl': 'images/rwh.svg',
        'title': 'RWH',
        'message': msg
    });
}
