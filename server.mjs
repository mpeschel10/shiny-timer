// Copied, with modification, from https://stackoverflow.com/a/29046869/6286797

import http from 'node:http';
import url from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const port = process.env.PORT ?? 22608;

http.createServer(function (req, res) {
  console.log(`${req.method} ${req.url}`);

  let parsedUrl = url.parse(req.url);
  if (parsedUrl.pathname === '/') {
    parsedUrl = url.parse('/timer.html');
  }
  let pathname = `serve${parsedUrl.pathname}`;
  const ext = path.parse(pathname).ext;
  const map = {
    '.ico': 'image/x-icon',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.svg': 'image/svg+xml',
  };

  fs.exists(pathname, function (exist) {
    if(!exist) {
      // if the file is not found, return 404
      res.statusCode = 404;
      res.end(`File ${pathname} not found!`);
      return;
    }

    fs.readFile(pathname, function(err, data){
      if(err){
        res.statusCode = 500;
        res.end(`Error getting the file: ${err}.`);
      } else {
        // if the file is found, set Content-type and send data
        res.setHeader('Content-type', map[ext] || 'text/plain' );
        res.end(data);
      }
    });
  });


}).listen(port);

console.log(`Server listening at http://localhost:${port}`);