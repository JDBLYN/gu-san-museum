// 自用小工具：一个最简单的本地服务器，只用 Node 自带模块，不安装任何东西。
//
// 为什么需要它：我们的页面用了 ES 模块 + fetch 读取 json，
// 这两种写法都必须通过 http 打开；直接双击 index.html（file://）会报错。
//
// 用法：在项目根目录运行
//   node tools/serve.js
// 然后浏览器打开
//   http://localhost:8000

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..'); // 项目根目录
const PORT = 8000;

// 根据文件后缀，告诉浏览器这是什么类型的文件
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  // 把网址变成文件路径；访问 / 就等于 /index.html
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);

  // 防止通过 ../ 访问到项目外面的文件
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`古伞文化馆 已在本地运行：http://localhost:${PORT}`);
});
