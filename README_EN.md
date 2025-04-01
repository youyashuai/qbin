<div align="center"><a name="readme-top"></a>
<img src="https://s3.tebi.io/lite/favicon.svg" width="20%" alt="QBin LOGO" title="QBin LOGO" />
<h1>QBin - Quick Storage</h1>

✨ Lightweight, elegant data storage service - more convenient than cloud drives, easily store and access text, images, videos, and any other data.

**English** · [简体中文](README.md) · [Official Website](https://qbin.me) · [Documentation](Docs/document.md) · [Self-hosting Guide](Docs/self-host.md)
</div>

## 📝 Project Overview
✨ A lightweight, elegant all-purpose data storage service, built around an online Code and Markdown editor, enabling one-click storage of text, code, images, videos, and any other data. <br/>
Distributed architecture + multi-level caching makes storage and retrieval faster, simple like a notepad, more convenient than cloud drives - record on the go, store and use instantly, starting your era of cloud data freedom!

## ✨ Key Features
- 🚀 **Convenient Storage**: Quickly save text, code, images, videos, and various data types
- 🔒 **Secure & Controllable**: Support for custom access paths and password protection
- ⏱️ **Flexible Expiration**: Set content expiration times
- 🌓 **Dark Mode**: Perfect adaptation to both light and dark themes
- 📱 **Comprehensive Compatibility**: Support for desktop and mobile devices
- 🔄 **Auto-Save**: Scheduled local backups to prevent data loss
- 🔑 **Third-party Login**: OAuth2 authorization support (Google, GitHub, LinuxDO)

## 🖼️ Preview
|                                       Desktop Interface                                         |                                     Mobile Interface                                      |
|:-------------------------------------------------------------------------------------:|:------------------------------------------------------------------------------------:|
| <img src="https://s3.tebi.io/lite/windows.png" alt="Desktop Preview" title="Desktop Preview" width="70%"> | <img src="https://s3.tebi.io/lite/mobile.png" alt="Mobile Interface" title="Mobile Interface" width="30%"> |

## 🚀 Quick Start Guide
### Login
1. Access your deployed QBin service
2. Default admin password is `qbin.me` (can be modified via the `ADMIN_PASSWORD` environment variable)
3. After logging in, select your preferred editor (Multi-function, Code, or Markdown)

### Share Content
1. Log in and access the editor interface
2. Set access path and password (optional)
3. Set expiration time (optional)
4. Enter text or upload files
5. Content is automatically saved and a sharing link is generated

### Access Content
1. Access content via sharing link or QR code
2. If password protected, enter the correct password
3. View or download content

> For detailed instructions, please check the [User Guide](https://qbin.me/r/document)

## ⚡ Self-hosting Deployment
### Docker Compose One-click Deployment (Recommended)
```bash
git clone https://github.com/Quick-Bin/qbin.git
cd qbin
docker-compose up -d
```
Access http://localhost:8000 to use the QBin service. All configurations are preset in docker-compose.yml (default admin password is `qbin.me`).

### Docker Command Line Deployment
```bash
# Pull the latest image
docker pull naiher/qbin:latest
# Start the container
docker run -it -p 8000:8000 \
  -e DATABASE_URL="postgresql://user:password@localhost:5432:/local:main?sslmode=require" \
  -e JWT_SECRET="your_jwt_secret" \
  -e ADMIN_PASSWORD="qbin.me" \
  -e ADMIN_EMAIL="admin@qbin.me" \
  naiher/qbin
```
After starting, access http://localhost:8000 to use the QBin service.

> Note: Using Docker command line deployment requires a PostgreSQL database. [Neon](https://neon.tech/), [Aiven](https://aiven.io/), or [Render](https://render.com/docs/deploy-mysql) provide free database solutions.

### Other Deployment Methods
For Deno Deploy or local development, please refer to the [Self-hosting Guide](Docs/self-host.md) for detailed steps.

## 🚀 TODO
- [ ] Implement end-to-end encryption
- [x] Add personal center dashboard
- [x] Add Markdown editor
- [x] Add API for third-party integration
- [x] Add Docker deployment support
- [x] Implement OAuth2 (Google, Github, LinuxDO) authorization login
- [x] Backend hot-cold multi-level storage
- [x] Adapt to mobile devices and dark mode
- [x] ETag negotiation cache
- [x] Implement local IndexedDB storage
- [x] Support for custom paths and passwords
- [x] Custom storage expiration times
- [x] Scheduled auto-save of local data

## 🤝 Contributing
You're welcome to contribute to the project through:
1. [Fork the project](https://github.com/Quick-Bin/Qbin/fork)
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Submit a Pull Request

## ❤ Sponsorship
If QBin has been helpful to you, please consider sponsoring through [Afdian](https://afdian.com/a/naihe)!

<a title="QBin Sponsor" href="https://afdian.com/a/naihe" target="_blank" rel="noopener noreferrer">
  <img src=https://s3.tebi.io/lite/Sponsor.svg width=25% alt="QBin Sponsor" title="QBin Sponsor" />
</a>

## License
This project is open-sourced under the [GPL-3.0](LICENSE) license.