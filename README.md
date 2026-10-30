# claude

Маркетплейс плагинов для Claude Code.

## Плагины

| Плагин | Автор | Что делает |
|---|---|---|
| [`anatomy`](https://github.com/wheresryan22/anatomy) | wheresryan22, MIT | Рисует интерактивные изометрические «живые машины» (SVG, по желанию WebGL и 3D) по одной строке текста |

Плагины подключаются из репозиториев их авторов: файлы здесь не копируются, обновления приходят автоматически.

## Установка

В Claude Code:

```
/plugin marketplace add Deni95/claude
/plugin install anatomy@deni95
```

Потом перезапустите Claude Code и напишите, например:

```
/anatomy how a car engine works
```

Для работы `anatomy` нужен Node.js 20.10+ и Chrome/Chromium (для проверки рисунков).
