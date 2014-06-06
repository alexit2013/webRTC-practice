# WebRTC practice

为了研究、实践WebRTC和WebSocket，而实现的视频录制、远程视频共享demo。
WebRTC能够在浏览器之间构建全双工的通信，WebSocket能够在浏览器和服务器之间构建全双工的通信，这给构建WebApp提供了很大的想象空间。
这个demo只是用于研究、实践新技术，目前只是在Windows8/Chrome35下测试可运行。
如果感兴趣，可以看一下源码是怎么实现的。

## 启动服务器

```
cd app
node bin/www
```

## 体验步骤

1. 用最新版的Chrome打开 [http://localhost:3000](http://localhost:3000)
2. 点击“打开摄像头”
3. 点击“开始录制”，经过一段时间后点“结束录制”，即可预览、保存录制的视频
4. 点击“开始视频共享”，浏览器地址栏中hash部分会出现一个room id，复制当前地址（带有room id），在一个新开的标签页中打开，点击“开始视频共享”，即可实现视频共享
