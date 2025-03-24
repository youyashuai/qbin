<div align="center"><a name="readme-top"></a>

<img src=https://s3.tebi.io/lite/favicon.svg width=25% alt="QBin LOGO" title="QBin LOGO" />
<h1>QBin - 快捷数据存储</h1>

这是一个小而美的便捷数据存储项目，它以编辑器为主体，你可以使用它快捷存储文字、图片、视频等任意数据。

**简体中文** · [English](README_EN.md) · [官网](https://qbin.me) · [使用文档](Docs/document.md) · [自部署指南](Docs/self-host.md) · [常见问题]()

<img alt="GitHub" src="https://img.shields.io/github/license/quick-bin/qbin">
<img alt="GitHub issues" src="https://img.shields.io/github/issues/quick-bin/qbin">
</div>

## 📝 项目简介
本项目使用 Deno + Oak + Postgres + Deno KV + Cache API + OAuth2 实现一个多级缓存的数据存储服务。<br/>
有赖于Serverless平台，不用购买服务器就能让每个人拥有属于自己的数据仓库。<br/>
项目支持快速部署，能够随开随用，像纸一样方便记录。

## 🚀 TODO计划
- [ ] 增加 Docker 部署支持
- [ ] 增加 MarkDown 编辑器
- [ ] 增加个人中心面板
- [ ] 实现端到端加密
- [x] 实现 OAuth2（Google、Github、LinuxDO） 授权登录
- [x] 后端热-冷多级存储
- [x] 适配移动端、深色模式
- [x] ETag 协商缓存
- [x] 实现本地 IndexedDB 存储
- [x] 存储支持自定义路径、自定义密码
- [x] 自定义存储有效期
- [x] 定时自动保存本地数据

## 🖼️ 功能预览
### 桌面端界面【浅色模式】

| 登录/注册 | 通用编辑器界面 |
|:---:|:---:|
| <img src="https://s3.tebi.io/lite/comp_login.jpg" alt="登录/注册" title="登录/注册界面" width="500"> | <img src="https://s3.tebi.io/lite/comp_editor.jpg" alt="通用编辑器界面" title="通用编辑器界面" width="500"> |

| 内容渲染界面 | 代码编辑器界面 |
|:---:|:---:|
| <img src="https://s3.tebi.io/lite/comp_render.jpg" alt="内容渲染界面" title="内容渲染界面" width="500"> | <img src="https://s3.tebi.io/lite/comp_code_editor.jpg" alt="代码编辑器界面" title="代码编辑器界面" width="500"> |

### 移动端界面【深色模式】

| 登录/注册 | 通用编辑器 | 内容渲染 | 代码编辑器 |
|:---:|:---:|:---:|:---:|
| <img src="https://s3.tebi.io/lite/phone_login.jpg" alt="登录/注册" title="登录/注册界面" width="175"> | <img src="https://s3.tebi.io/lite/phone_editor.jpg" alt="通用编辑器界面" title="通用编辑器界面" width="175"> | <img src="https://s3.tebi.io/lite/phone_render.jpg" alt="内容渲染界面" title="内容渲染界面" width="175"> | <img src="https://s3.tebi.io/lite/phone_code_editor.jpg" alt="代码编辑器界面" title="代码编辑器界面" width="175"> |

## ⚡️ 性能测试

| Desktop | Mobile |
| :-----: | :----: |
| ![](https://s3.tebi.io/lite/comp_analysis.jpg) | ![](https://s3.tebi.io/lite/phone_analysis.jpg) |

## ✨ 核心特性

<img src="https://s3.tebi.io/lite/contrast2.svg" width="80%">


## 🚀 快速开始

#### 获取免费Postgres 数据库

|    名称    |           免费容量           |
|:--------:|:------------------------:|
| [Aiven](https://aiven.io/) |       免费5 GB数据库空间        |
| [Neon](https://neon.tech/) | 免费0.5 GB数据库空间，弹性扩展，零停机时间 |
| [Render](https://render.com/docs/deploy-mysql) |      免费10 GB 数据库空间       |

### Deno 部署

1. 准备一个 Postgres 数据库
2. 🌟Star 和 [Fork](https://github.com/Quick-Bin/Qbin/fork) 此项目
3. 登录/注册 https://dash.deno.com
4. 创建项目 https://dash.deno.com/new_project
5. 选择此项目，填写项目名字（请仔细填写项目名字，关系到自动分配的域名）
6. Entrypoint 填写 index.ts 其他字段留空
7. 配置环境变量
7. 点击 Deploy Project
8. 部署成功后获得域名，点开即用。

> \[!NOTE]
> 
> 详细的部署步骤请参考 [自部署指南](Docs/self-host.md)


### 环境变量
本项目提供了一些额外的配置项，使用环境变量进行设置：

#### 基础配置
|      环境变量       | 类型 |         描述          |                                   示例                                    |
|:---------------:|:--:|:-------------------:|:-----------------------------------------------------------------------:|
| `ADMIN_PASSWORD` | 必选 |       管理员访问密码       |                                `qbin.me`                                |
| `ADMIN_EMAIL` | 必选 |       管理员邮箱地址       |                         `ww1998mail@gmail.com`                          |
| `DATABASE_URL`  | 必选 |  Postgres 数据库连接地址   | `postgresql://user:password@localhost:5432:/local:main?sslmode=require` |
| `JWT_SECRET`   | 必选 |       JWT签名密钥       |                    `XTV0STZzYFxxxxxxxxxx5ecm50W04v`                     |
| `PORT` | 可选 |       服务访问端口        |                                 `8000`                                  |
| `TOKEN_EXPIRE` | 可选 |    令牌有效期(秒)，默认一年    |                               `31536000`                                |
| `MAX_UPLOAD_FILE_SIZE` | 可选 | 最大上传文件大小(字节)，默认50MB |                               `52428800`                                |

#### GitHub OAuth配置
|      环境变量       | 类型 |          描述          |                            示例                             |
|:---------------:|:--:|:--------------------:|:---------------------------------------------------------:|
| `GITHUB_CLIENT_ID` | 可选 | GitHub OAuth应用客户端ID | `Ovxxxxxxxxxfle8Oyi` |
| `GITHUB_CLIENT_SECRET` | 可选 | GitHub OAuth应用客户端密钥 | `56ab9xxxxxxxxxxxxxx4012184b426` |
| `GITHUB_CALLBACK_URL` | 可选 | GitHub OAuth回调地址 | `http://localhost:8000/api/login/oauth2/callback/github` |

#### Google OAuth配置
|      环境变量       | 类型 |          描述          |                            示例                             |
|:---------------:|:--:|:--------------------:|:---------------------------------------------------------:|
| `GOOGLE_CLIENT_ID` | 可选 | Google OAuth应用客户端ID | `84932xxxxx-gbxxxxxxxxxxxxjg8s3v.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | 可选 | Google OAuth应用客户端密钥 | `GOCSPX-xxxxxxxxxxxxxxxxxxxx` |
| `GOOGLE_CALLBACK_URL` | 可选 | Google OAuth回调地址 | `http://localhost:8000/api/login/oauth2/callback/google` |

#### LinuxDO OAuth配置
|      环境变量       | 类型 |          描述          |                            示例                             |
|:---------------:|:--:|:--------------------:|:---------------------------------------------------------:|
| `LINUXDO_CLIENT_ID` | 可选 | LinuxDO OAuth应用客户端ID | `V4HmbQixxxxxxxxxxxxCJ2CVypqL` |
| `LINUXDO_CLIENT_SECRET` | 可选 | LinuxDO OAuth应用客户端密钥 | `hZtE3cxxxxxxxxxxxxxkZ0al01Hi` |
| `LINUXDO_CALLBACK_URL` | 可选 | LinuxDO OAuth回调地址 | `http://localhost:8000/api/login/oauth2/callback/linuxdo` |
| `LINUXDO_USER_LEVEL` | 可选 | LinuxDO用户登录所需的最低等级 | `0` |


## 🚀 使用方法
### 分享内容
1. 登录后进入编辑器界面
2. 设置访问路径或访问密码
3. 设置过期时间
4. 选择或拖拽文件上传 或者 输入文字内容

### 获取分享内容
1. 通过输入访问路径，或者使用QR分享进入网页
2. 下载文件或查看文本


> \[!NOTE]
> 
> 详细的使用教程请参考 [使用指南](https://qbin.me/r/document)


## 🛠 开发指南

### 项目结构
```text
QBin/
├── src/                   # 源代码目录
│   ├── config/            # 应用配置信息
│   │   └── ...            # 各种配置文件
│   ├── db/                # 数据库相关代码
│   │   └── ...            # 数据模型和数据库连接
│   ├── middlewares/       # 中间件目录
│   │   └── ...            # 身份验证、错误处理等中间件
│   ├── utils/             # 实用工具函数
│   │   └── ...            
│   ├── templates/         # 前端HTML代码
│   │   └── ...            
│   └── static/            # 静态资源文件
│       ├── css/ 
│       ├── img/ 
│       └── js/
└── index.ts                # 启动程序入口
```

### 本地调试

Windows PowerShell 安装 Deno:

    irm https://deno.land/install.ps1 | iex

Mac/Linux 安装 Deno:

    curl -fsSL https://deno.land/install.sh | sh

启动项目：

    cd 项目目录
    deno run --allow-net --allow-env --allow-read --unstable-kv --unstable-broadcast-channel index.ts


## 🤝 参与贡献

我们非常欢迎各种形式的贡献。如果你对贡献代码感兴趣，欢迎大展身手，向我们展示你的奇思妙想。
1. [Fork](https://github.com/Quick-Bin/Qbin/fork) 本项目
2. 创建新分支 git checkout -b feature/xxx
3. 提交更改 git commit -m 'Add xxx'
4. 推送到分支 git push origin feature/xxx
5. 提交 Pull Request


## ❤ 赞助

每一分支持都珍贵无比，汇聚成我们支持的璀璨银河！你就像一颗划破夜空的流星，瞬间点亮我们前行的道路。感谢你对我们的信任 —— 你的支持笔就像星辰导航，一次又一次地为项目指明前进的光芒。

<a title="QBin Sponsor" href="https://afdian.com/a/naihe" target="_blank" rel="noopener noreferrer">
  <img src=https://s3.tebi.io/lite/Sponsor.svg width=25% alt="QBin Sponsor" title="QBin Sponsor" />
</a>


## License

**License under [GPL-3.0](LICENSE).**
