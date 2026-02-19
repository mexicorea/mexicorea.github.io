---
title: 'Codex CLI에서 한글 입력일 때 Ctrl+C 안 먹는 문제, Karabiner로 우회하기'
description: 'terminal(ghostty)에서 codex cli 쓰다가 한글 입력 상태면 Ctrl+C가 안 먹는 이슈가 있어서, Karabiner로 Ctrl+B/C/Z 직전에 input source를 ABC로 강제 전환하도록 설정.'
pubDate: 'Feb 19 2026'
---

요즘 Ghostty에서 Codex CLI를 자주 쓰는데, 한 가지 불편한 점이 있었다. 한글 입력 상태(IME on)에서는 `Ctrl + C`가 바로 안 먹고, 영어(ABC)로 바꾼 다음에야 비로소 종료가 되는 부분이다. 이미지를 캡쳐해서 붙여 넣는 경우(`Ctrl + V`)에도 마찬가지이다. 이런 게 은근히 흐름을 자꾸 끊어서, Karabiner로 우회해뒀다.

`Ctrl + B`, `Ctrl + C`, `Ctrl + V`, `Ctrl + Z`를 누르면:
1. 먼저 input source를 `ABC`로 바꾸고
2. 그 다음 원래 단축키를 그대로 출력하는 방식이다.


## 1) Karabiner 설치

```bash
brew install --cask karabiner-elements
```

## 2) Rule 설정


```json
{
  "description": "Switch to ABC before Ctrl+B/C/V/Z",
  "manipulators": [
    {
      "type": "basic",
      "from": { "key_code": "b", "modifiers": { "mandatory": ["control"] }},
      "to": [
        { "select_input_source": { "input_source_id": "com.apple.keylayout.ABC" }},
        { "key_code": "b", "modifiers": ["control"] }
      ]
    },
    {
      "type": "basic",
      "from": { "key_code": "c", "modifiers": { "mandatory": ["control"] }},
      "to": [
        { "select_input_source": { "input_source_id": "com.apple.keylayout.ABC" }},
        { "key_code": "c", "modifiers": ["control"] }
      ]
    },
    {
      "type": "basic",
      "from": { "key_code": "v", "modifiers": { "mandatory": ["control"] }},
      "to": [
        { "select_input_source": { "input_source_id": "com.apple.keylayout.ABC" }},
        { "key_code": "v", "modifiers": ["control"] }
      ]
    },
    {
      "type": "basic",
      "from": { "key_code": "z", "modifiers": { "mandatory": ["control"] }},
      "to": [
        { "select_input_source": { "input_source_id": "com.apple.keylayout.ABC" }},
        { "key_code": "z", "modifiers": ["control"] }
      ]
    }
  ]
}
```

