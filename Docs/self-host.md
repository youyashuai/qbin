Coming soon.

---

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

### 环境变量
本项目提供了一些额外的配置项，使用环境变量进行设置：

#### 基础配置
|      环境变量       | 类型 |         描述          |                                   示例                                    |
|:---------------:|:--:|:-------------------:|:-----------------------------------------------------------------------:|
| `ADMIN_PASSWORD` | 必选 |       管理员访问密码       |                                `qbin.me`                                |
| `ADMIN_EMAIL` | 必选 |       管理员邮箱地址       |                         `admin@qbin.me`                          |
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

---

2. 点击 [Deploy on Deno](https://dash.deno.com/new_project?url=https://github.com/Quick-Bin/Qbin)（首次点击要先登录Deno Deploy，登录完成之后重新点击这个链接即可进行部署）
3. 部署完成后设置环境变量
- 环境变量设置方法
  
  在project的setting中的Environment Variables点击Add Variable
<img src="https://s3.tebi.io/lite/Environment.jpg" width="80%">
3. 在project的settings中自定义自己的二级域名或者绑定自己的域名
<img src="https://s3.tebi.io/lite/custom_url.jpg" width="80%">
