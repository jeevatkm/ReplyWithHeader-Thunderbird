/*
 * Copyright (c) Jeevanandam M. (jeeva@myjeeva.com)
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at
 * https://github.com/jeevatkm/ReplyWithHeaderMozilla/blob/master/LICENSE
 */

'use strict'; 
 
// encoding: utf-8

var i18n = {
  "lang": {
    "en-US": "English",
    "en-GB": "English",
    "en-AU": "English",
    "fr": "French - Français",
    "de": "German - Deutsch",
    "es": "Spanish - Español",
    "it": "Italian",
    "ja": "Japanese - 日本語",
    "pl": "Polish - Polski",
    "ar": "Arabic - العربية",
    "pt": "Portuguese - Português",
    "pt-BR": "Portuguese - Brazil",
    "ko": "Korean",
    "nl": "Dutch",
    "nb": "Norwegian",
    "ru": "Russian",
    "sv": "Swedish",
    "fi": "Finnish",
  },
  "from": {
    "en-US": "From:",
    "en-GB": "From:",
    "en-AU": "From:",
    "fr": "De :",
    "de": "Von:",
    "es": "De:",
    "it": "Da:",
    "ja": "送信者:",
    "pl": "Od:",
    "ar": "من :",
    "pt": "De:",
    "pt-BR": "De:",
    "ko": "보낸 사람:",
    "nl": "Van:",
    "nb": "Fra:",
    "ru": "От:",
    "sv": "Från:",
    "fi": "Lähettäjä:",
  },
  "to": {
    "en-US": "To:",
    "en-GB": "To:",
    "en-AU": "To:",
    "fr": "Pour :",
    "de": "An:",
    "es": "Para:",
    "it": "A:",
    "ja": "宛先:",
    "pl": "Do:",
    "ar": "إلى :",
    "pt": "Para:",
    "pt-BR": "Para:",
    "ko": "받는 사람:",
    "nl": "Aan:",
    "nb": "Til:",
    "ru": "Кому:",
    "sv": "Till:",
    "fi": "Vastaanottaja:",
  },
  "cc": {
    "en-US": "Cc:",
    "en-GB": "Cc:",
    "en-AU": "Cc:",
    "fr": "Cc :",
    "de": "Cc:",
    "es": "Cc:",
    "it": "Cc:",
    "ja": "Cc:",
    "pl": "Cc:", // or "Do wiadomości"
    "ar": "Cc :",
    "pt": "Cc:",
    "pt-BR": "Cc:",
    "ko": "참조:",
    "nl": "Cc:",
    "nb": "Kopi:",
    "ru": "Копия:",
    "sv": "Kopia:",
    "fi": "Kopio:",
  },
  "subject": {
    "en-US": "Subject:",
    "en-GB": "Subject:",
    "en-AU": "Subject:",
    "fr": "Objet :",
    "de": "Betreff:",
    "es": "Asunto:",
    "it": "Oggetto:",
    "ja": "件名:",
    "pl": "Temat:",
    "ar": "الموضوع :",
    "pt": "Assunto:",
    "pt-BR": "Assunto:",
    "ko": "제목:",
    "nl": "Onderwerp:",
    "nb": "Emne:",
    "ru": "Тема:",
    "sv": "Ämne:",
    "fi": "Aihe:",
  },
  "date": {
    "en-US": "Date:",
    "en-GB": "Date:",
    "en-AU": "Date:",
    "fr": "Date :",
    "de": "Datum:",
    "es": "Fecha:",
    "it": "Data:",
    "ja": "日時:",
    "pl": "Data:",
    "ar": "التاريخ :",
    "pt": "Data:",
    "pt-BR": "Data:",
    "ko": "날짜:",
    "nl": "Datum:",
    "nb": "Dato:",
    "ru": "Дата:",
    "sv": "Datum:",
    "fi": "Päiväys:",
  },
  "sent": {
    "en-US": "Sent:",
    "en-GB": "Sent:",
    "en-AU": "Sent:",
    "fr": "Envoyé :",
    "de": "Gesendet:",
    "es": "Enviado:",
    "it": "Inviata:",
    "ja": "送信メール:",
    "pl": "Wysłane:",
    "ar": "المرسلة :",
    "pt": "Enviado:",
    "pt-BR": "Enviado:",
    "ko": "보낸 날짜:",
    "nl": "Verzonden:",
    "nb": "Sendt:",
    "ru": "Отправлено:",
    "sv": "Skickat",
    "fi": "Lähetetty:",
  },
  "forwarded_message": {
    "en-US": "Forwarded Message",
    "en-GB": "Forwarded Message",
    "en-AU": "Forwarded Message",
    "fr": "Message transféré",
    "de": "Weitergeleitete Nachricht",
    "es": "Mensaje reenviado",
    "it": "messaggio inoltrato",
    "ja": "転送メール",
    "pl": "Przekazana wiadomość",
    "ar": "اعادة التوجيه",
    "pt": "Mensagem encaminhada",
    "pt-BR": "Encaminhou",
    "ko": "전달된 메시지",
    "nl": "Doorgestuurd bericht",
    "nb": "Videresendt melding",
    "ru": "переадресованного сообщения",
    "sv": "Vidarebefordrat brev",
    "fi": "Välitetty viesti",
  },
  "original_message": {
    "en-US": "Original Message",
    "en-GB": "Original Message",
    "en-AU": "Original Message",
    "fr": "Message d'origine",
    "de": "Ursprüngliche Nachricht",
    "es": "Mensaje original",
    "it": "messaggio originale",
    "ja": "元のメール",
    "pl": "Wiadomość oryginalna",
    "ar": "الرسالة الأصلية",
    "pt": "Mensagem original",
    "pt-BR": "mensagem original",
    "ko": "원본 메시지",
    "nl": "Originele bericht",
    "nb": "Opprinnelig melding",
    "ru": "Оригинал сообщения",
    "sv": "Ursprungligt meddelande",    
    "fi": "Alkuperäinen viesti",
  },
};
