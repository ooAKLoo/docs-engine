import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BoardCanvas} from '../dist/components/BoardCanvas.js';
import {importMermaid} from '../dist/components/MermaidImporter.js';

function renderDocument(document) {
  return renderToStaticMarkup(React.createElement(BoardCanvas, {
    accessibleLabel: '布局回归',
    document,
    editable: false,
    fitContent: true,
    panActive: false,
  }));
}

function groupRectangles(markup) {
  return [...markup.matchAll(
    /<g class="de-board__group" data-de-group-id="([^"]+)"[^>]*><rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/gu,
  )].map((match) => ({
    bottom: Number(match[3]) + Number(match[5]),
    id: match[1],
    left: Number(match[2]),
    right: Number(match[2]) + Number(match[4]),
    top: Number(match[3]),
  }));
}

test('lays out top-level architecture groups as non-overlapping semantic containers', async () => {
  const document = await importMermaid(`flowchart LR
    subgraph Access[接入与装配]
      bootstrap[组合根]
      gateway[设备网关]
      guardian[家长控制面]
    end
    subgraph Interaction[儿童交互]
      realtime[实时语音]
      experience[儿童体验]
      runtime[模型运行时]
    end
    subgraph Facts[稳定产品事实]
      data[(儿童数据)]
      library[(内容目录)]
      safety[儿童安全]
    end
    subgraph Support[观测与分析]
      analytics[(产品分析)]
      operations[运行观测]
    end
    gateway --> realtime
    realtime --> experience
    experience --> data
    experience --> library
    experience --> safety
    safety --> runtime
    guardian --> analytics
    realtime -. 技术事件 .-> operations`);
  const rectangles = groupRectangles(renderDocument(document));

  assert.deepEqual(rectangles.map(({id}) => id), ['Access', 'Interaction', 'Facts', 'Support']);
  rectangles.forEach((first, firstIndex) => {
    rectangles.slice(firstIndex + 1).forEach((second) => {
      const overlapsHorizontally = Math.min(first.right, second.right) > Math.max(first.left, second.left);
      const overlapsVertically = Math.min(first.bottom, second.bottom) > Math.max(first.top, second.top);
      assert.equal(
        overlapsHorizontally && overlapsVertically,
        false,
        `${first.id} 与 ${second.id} 的容器不能重叠`,
      );
    });
  });
});

test('renders sequence participants on one header row and messages on distinct time rows', async () => {
  const document = await importMermaid(`sequenceDiagram
    autonumber
    participant App as 小程序
    participant WX as 微信
    participant API as Lula Server
    participant ESP as ESP32
    participant DB as Postgres Account Store
    App->>WX: wx.login 获取 code
    App->>API: POST /auth/wechat-login + code
    API->>DB: upsert user
    API-->>App: Lula App JWT
    App->>ESP: 写入设备凭证`);
  const markup = renderDocument(document);
  const actorPositions = [...markup.matchAll(
    /data-de-node-id="actor:[^"]+"[^>]*transform="translate\(([-\d.]+) ([-\d.]+)\)"/gu,
  )].map((match) => ({x: Number(match[1]), y: Number(match[2])}));
  const messageRows = [...markup.matchAll(
    /<path d="M [-\d.]+ ([-\d.]+)[^"]*" class="de-board__edge-path"/gu,
  )].map((match) => Number(match[1]));
  const lifelines = markup.match(/<g class="de-board__lifelines">([\s\S]*?)<\/g>/u)?.[1] ?? '';

  assert.equal(actorPositions.length, 5);
  assert.equal(new Set(actorPositions.map(({y}) => y)).size, 1);
  assert.deepEqual(actorPositions.map(({x}) => x), [...actorPositions.map(({x}) => x)].sort((a, b) => a - b));
  assert.equal((lifelines.match(/<line /gu) ?? []).length, 5);
  assert.equal(messageRows.length, 5);
  assert.equal(new Set(messageRows).size, 5);
  assert.deepEqual(messageRows, [...messageRows].sort((a, b) => a - b));
});
