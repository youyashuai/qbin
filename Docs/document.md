## 前端界面功能介绍

**编辑器界面**

* ![截图1](https://s3.tebi.io/lite/425735986-f239c40d-18ba-4136-ab0d-a7dcffa20aa8.png)  顶部图标

1. `☁️`表示在线内容
2. `☁`表示本地内容
3. `⊘`表示这是不可用的KEY

* 设置面板
1. ![svg-image](https://s3.tebi.io/lite/425735477-8dc3144b-3f67-4078-90d2-d8bea4f33927.png) 为代码编辑器，点击图标进入
2. ![截图_20250322180239](https://s3.tebi.io/lite/425735809-157cd6b0-d9fb-4032-bfac-fecc49bf5191.png) 为MarkDown编辑器
3. ![截图_20250322180403](https://s3.tebi.io/lite/425735896-43e4e7f2-38dd-459b-9a97-3bbfae798ecc.png) 为通用编辑器
4. KEY 为访问内容路径，最大长度为32位，最小长度为2位，默认自动生成
5. PWD 为访问内容密码，最大长度为32位，最小长度为2位，默认自动生成
6. `👁️` 点击进入到预览内容界面

当你保存内容后，你可以在其他设备通过浏览器访问 `https://qbin.me/r/<key>/[pwd]`，例如`https://qbin.me/r/document`

在通用编辑器中支持上传文件，操作方式有点击选择、粘贴或拖放

**预览内容界面**

1. Copy 单击复制内容，双击复制内容链接
2. Fork 复制内容到编辑器界面
3. QR 生成二维码和复制链接选项
4. Raw 查看原始内容
5. New 进入新的空白内容编辑器
6. Del 删除内容，如果本地存在缓存也会删除

**注意**：

	只有创建者可以修改和删除存储在对应KEY的内容

## REST API

* 原始内容 	    GET `https://qbin.me/r/<key>/[pwd]`
* 预览     		GET `https://qbin.me/p/<key>/[pwd]`
* 上传文本		POST `https://qbin.me/s/<key>/[pwd]`
* 上传文件		PUT `https://qbin.me/s/<key>/[pwd]`
* 删除内容		DELETE `https://qbin.me/d/<key>/[pwd]`
* 查看内容类型 	HEAD `https://qbin.me/r/<key>/[pwd]`

**注意**：

	除了查看原始内容api，其他接口都需要添加Cookie调用
	<>内容为必选		[]内容为可选
