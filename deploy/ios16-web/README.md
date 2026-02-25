# iOS 16.2 兼容热修（静态包）

这是一份可直接部署的 Web 静态文件（含 `assets/`、`index.html`、`sw.js`、`gateway.js`），用于解决 iOS 16.2 下可能出现的 PWA/缓存相关兼容问题。

## 本地启动（可选）

在此目录下执行：

```bash
node gateway.js
```

可用环境变量覆盖端口与 Hub 地址：

```bash
PORT=8088 HUB_ORIGIN=http://127.0.0.1:3006 node gateway.js
```

