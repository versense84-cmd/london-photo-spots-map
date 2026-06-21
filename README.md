# 小红书坐标转 Google Maps

一个把旅行笔记中的地点转换成地图候选点位的网页工具。前端保留照片集合、地图微调和导出能力，后端代理负责保护 Google/OpenAI API Key。

## 功能

- 粘贴小红书笔记或地点列表，提取地点、已有坐标和说明
- 无坐标地点通过 Google Places Text Search 查询候选坐标
- 城市 / 国家上下文提高同名地点匹配准确度
- 高、中、低可信度标记与候选结果确认
- 地图 marker 拖动微调，拖动后标记为人工确认
- 支持 emoji 序号、普通数字序号、`坐标` 和 `GPS 坐标`
- 支持 `* London Eye` 一类无坐标列表
- 可选 AI 智能识别复杂长文；AI 不允许编造坐标
- 地图预览、点击取点与拖动微调
- 手动新增、编辑和删除点位
- 每个地点保留参考照片上传档位，图片压缩后存储在浏览器本地
- 生成 Google Maps 单点链接与步行路线链接
- 下载 Google My Maps / Google Earth 可用的 KML
- 下载 Google My Maps 可用的 CSV
- 导入和导出 JSON 备份
- 复制整理后的小红书文案
- 使用 `localStorage` 保存点位、查询缓存和最终选择结果
- 每批最多查询 20 个缺坐标地点；服务端默认每个 IP 每天最多 10 次批量查询

## 本地运行

需要 Node.js 18 或更高版本。复制环境变量模板：

```bash
cp .env.example .env
```

至少配置 Google Maps Key：

```env
GOOGLE_MAPS_API_KEY=你的服务端Key
```

可选 AI 提取：

```env
OPENAI_API_KEY=你的OpenAIKey
OPENAI_MODEL=gpt-4.1-mini
```

Google Cloud 需要启用 **Places API (New)**。API Key 只存在 `.env` 和服务端请求中，不会进入浏览器代码。

```bash
npm install
npm run dev
```

`npm run dev` 会同时启动 API 代理和 Vite 前端。浏览器地址：

```text
http://127.0.0.1:4173/
```

## 生产构建

```bash
npm run build
npm run preview
```

## 数据与隐私

点位、照片和地点查询缓存保存在当前浏览器的 `localStorage` 中。只有点击“查询缺失坐标”时，地点名与城市会发送到本地 API 代理，再由代理请求 Google Places。只有点击“AI 智能识别地点”时，笔记文字才会发送给配置的 AI 服务。

地图底图来自 OpenStreetMap。Google Maps 链接只会在用户主动点击时打开。
