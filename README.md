<div align="center"><a name="readme-top"></a>

<img src=https://s3.tebi.io/lite/favicon.svg width=20% alt="QBin LOGO" title="QBin LOGO" />
<h1>QBin - 快捷数据存储</h1>

简洁高效的数据存储服务，以编辑器为核心，轻松存储文字、图片、视频等任意数据。

**简体中文** · [English](README_EN.md) · [官网](https://qbin.me) · [使用文档](Docs/document.md) · [自托管教程](Docs/self-host.md)

<img alt="GitHub" src="https://img.shields.io/github/license/quick-bin/qbin">
<img alt="GitHub issues" src="https://img.shields.io/github/issues/quick-bin/qbin">
</div>

## 📝 项目简介

QBin 是一个轻量级数据存储服务，使用 Deno + PostgreSQL 构建，支持多级缓存。无需购买服务器即可拥有个人数据仓库，随开随用，像纸一样方便记录。

## ✨ 核心特性

- 🚀 **便捷存储**：快速保存文字、代码、图片、视频等多种数据
- 🔒 **安全可控**：支持自定义访问路径和密码保护
- ⏱️ **灵活期限**：可设置内容过期时间
- 🌓 **深色模式**：完美适配明暗两种主题
- 📱 **全面适配**：支持桌面端和移动端
- 🔄 **自动保存**：定时本地备份，防止数据丢失
- 🔑 **第三方登录**：支持 Google、GitHub、LinuxDO 授权

## 🖼️ 功能预览

|                                         桌面端界面                                         |                                        移动端界面                                         |
|:-------------------------------------------------------------------------------------:|:------------------------------------------------------------------------------------:|
| <img src="https://s3.tebi.io/lite/windows.png" alt="桌面端预览" title="桌面端预览" width="70%"> | <img src="https://s3.tebi.io/lite/mobile.png" alt="移动端界面" title="移动端界面" width="30%"> |

## 🚀 快速使用指南

### 登录系统

1. 访问部署好的 QBin 系统
2. 默认管理员密码是 `qbin.me`（可通过环境变量 `ADMIN_PASSWORD` 修改）
3. 登录后即可开始使用所有功能

### 分享内容

1. 登录后进入编辑器界面
2. 设置访问路径或密码（可选）
3. 设置过期时间（可选）
4. 输入文字或上传文件
5. 自动保存并获取分享链接

### 访问内容

1. 通过分享链接或访问路径打开内容
2. 如有密码保护，输入密码访问
3. 查看或下载内容

> 详细使用教程请查看 [使用指南](https://qbin.me/r/document)

## ⚡ 自托管部署

### Docker Compose 一键部署（推荐）

```bash
git clone https://github.com/Quick-Bin/Qbin.git
cd Qbin
docker-compose up -d
```

访问 http://localhost:8000 即可使用 QBin，所有配置已在 docker-compose.yml 中预设好（默认管理员密码为 `qbin.me`）。

### Docker 命令行部署

```bash
# 拉取最新镜像
docker pull naiher/qbin:latest

# 启动容器
docker run -it -p 8000:8000 \
  -e DATABASE_URL="postgresql://user:password@localhost:5432:/local:main?sslmode=require" \
  -e JWT_SECRET="your_jwt_secret" \
  -e ADMIN_PASSWORD="qbin.me" \
  -e ADMIN_EMAIL="admin@qbin.me" \
  naiher/qbin
```

启动后，访问 http://localhost:8000 即可使用 QBin。

> 注意：使用 Docker 命令行部署需要准备 PostgreSQL 数据库，[Neon](https://neon.tech/)、[Aiven](https://aiven.io/) 或 [Render](https://render.com/docs/deploy-mysql) 均提供免费方案。

### 其他部署方式

如需使用 Deno Deploy 或本地开发，请参考 [自托管教程](Docs/self-host.md) 获取详细步骤。

## 🚀 TODO 计划
- [ ] 增加 MarkDown 编辑器
- [ ] 增加个人中心面板
- [ ] 实现端到端加密
- [x] 增加 Docker 部署支持
- [x] 实现 OAuth2（Google、Github、LinuxDO） 授权登录
- [x] 后端热-冷多级存储
- [x] 适配移动端、深色模式
- [x] ETag 协商缓存
- [x] 实现本地 IndexedDB 存储
- [x] 存储支持自定义路径、自定义密码
- [x] 自定义存储有效期
- [x] 定时自动保存本地数据

## 🤝 参与贡献

欢迎通过以下方式参与项目：

1. [Fork 项目](https://github.com/Quick-Bin/Qbin/fork)
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

## ❤ 赞助支持

如果 QBin 对您有所帮助，欢迎通过 [爱发电](https://afdian.com/a/naihe) 提供赞助支持！

<a title="QBin Sponsor" href="https://afdian.com/a/naihe" target="_blank" rel="noopener noreferrer">
  <img src=https://s3.tebi.io/lite/Sponsor.svg width=25% alt="QBin Sponsor" title="QBin Sponsor" />
</a>

## 许可证

本项目采用 [GPL-3.0](LICENSE) 许可证开源。
