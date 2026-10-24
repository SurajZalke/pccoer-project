'use strict';

/**
 * whatsapp/message_media.js
 *
 * Minimal, dependency-free replacement for whatsapp-web.js `MessageMedia`.
 * Holds a base64 payload + mimetype + filename; `client.sendMessage()` reads
 * these fields and hands the buffer to Baileys.
 */

const fs   = require('fs');
const path = require('path');

const EXT_MIME = {
  '.pdf':  'application/pdf',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.bmp':  'image/bmp',
  '.mp4':  'video/mp4',
  '.3gp':  'video/3gpp',
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
  '.m4a':  'audio/mp4',
  '.txt':  'text/plain',
  '.csv':  'text/csv',
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls':  'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt':  'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip':  'application/zip',
};

class MessageMedia {
  /**
   * @param {string} mimetype
   * @param {string} data      base64-encoded file contents
   * @param {string} [filename]
   */
  constructor(mimetype, data, filename) {
    this.mimetype = mimetype;
    this.data     = data;
    this.filename = filename;
  }

  /** Build a MessageMedia from a file on disk. */
  static fromFilePath(filePath) {
    const data     = fs.readFileSync(filePath).toString('base64');
    const mimetype = EXT_MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    return new MessageMedia(mimetype, data, path.basename(filePath));
  }
}

module.exports = { MessageMedia };
