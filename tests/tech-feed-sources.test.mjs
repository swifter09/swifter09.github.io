import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const schema = fs.readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')

test('technology feed seeds include public source pages', () => {
  const expectedSources = new Map([
    ['腾讯技术工程', 'https://developer.cloud.tencent.com/'],
    ['阿里云开发者', 'https://developer.aliyun.com/'],
    ['字节跳动技术团队', 'https://juejin.cn/user/1838039172387262/posts'],
  ])

  for (const [name, homepageUrl] of expectedSources) {
    assert.match(
      schema,
      new RegExp(`'${name}'[\\s\\S]{0,120}'${homepageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`),
    )
  }
})

test('existing technology feed rows receive the source pages on schema reruns', () => {
  assert.match(schema, /update public\.sources as source/)
  assert.match(schema, /source\.source_type = 'wechat'/)
})
