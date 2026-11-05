# Sons do Claude Code no Windows

Configuração que toca um som quando o Claude Code termina uma resposta e outro quando ele precisa da sua permissão para continuar.

Este arquivo é só um guia, não altera nada no app. Ele também não ativa os sons sozinho: é preciso copiar o bloco abaixo para o `settings.json` do usuário em cada PC.

## Como funciona

O Claude Code tem **hooks**: comandos que ele roda sozinho quando acontece um evento. Aqui são usados dois eventos:

| Evento | Quando acontece | Som |
|---|---|---|
| `Stop` | O Claude terminou de responder e está esperando você | `Windows Unlock.wav` |
| `Notification` com `matcher: "permission_prompt"` | O Claude precisa que você aprove uma ação (pedido de permissão) | `Windows Exclamation.wav` |

O comando de cada hook abre o PowerShell e toca um arquivo `.wav` que já vem no Windows, na pasta `C:\Windows\Media`. Com `"async": true`, o som toca em segundo plano e não atrasa o Claude.

## Onde fica

No arquivo de configurações do usuário, que vale para todos os projetos:

```
%USERPROFILE%\.claude\settings.json
```

Exemplo: `C:\Users\mauga\.claude\settings.json`. Se quiser os sons só num projeto, use `.claude\settings.json` dentro da pasta do projeto.

## Configurar no PC novo

1. Instale o Claude Code e abra-o uma vez, para ele criar a pasta `%USERPROFILE%\.claude`.
2. Abra (ou crie) o arquivo `%USERPROFILE%\.claude\settings.json`.
3. Coloque o bloco `"hooks"` abaixo dentro das chaves principais do arquivo. Se o arquivo já tiver outras configurações, acrescente o bloco separado por vírgula, sem apagar o que já existe.

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "permission_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "powershell.exe -NoProfile -Command \"(New-Object Media.SoundPlayer 'C:\\Windows\\Media\\Windows Exclamation.wav').PlaySync()\"",
            "async": true
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "powershell.exe -NoProfile -Command \"(New-Object Media.SoundPlayer 'C:\\Windows\\Media\\Windows Unlock.wav').PlaySync()\"",
            "async": true
          }
        ]
      }
    ]
  }
}
```

4. Feche e abra o Claude Code de novo. Para conferir se os hooks foram carregados, digite `/hooks` dentro dele.

Atalho: no PC novo, também dá para pedir ao próprio Claude Code "configure um som quando terminar e quando pedir permissão", colando este arquivo na conversa.

## Vai Funcionar em Outro PC?

Num Windows 10 ou 11, sim, sem alterar nada: o comando usa só o `powershell.exe` e os sons de `C:\Windows\Media`, que já vêm no sistema, e não depende do nome do usuário. Confira:

1. **Arquivo certo:** `%USERPROFILE%\.claude\settings.json` (a pasta `.claude` só existe depois de abrir o Claude Code uma vez).
2. **Não duplicar as chaves:** se o arquivo já existir, não cole o exemplo inteiro por cima nem embaixo dele. Copie só o trecho `"hooks": { ... }` para dentro das chaves que já existem, separado por vírgula. Um JSON mal montado faz o Claude Code ignorar o arquivo.
3. **Reiniciar:** feche e abra o Claude Code e confira com `/hooks` se aparecem `Stop` e `Notification`.
4. **Testar o som:** rode o comando da seção abaixo. Se tocar no PowerShell, toca pelo Claude Code também.

Em Mac ou Linux não funciona, porque não existem `powershell.exe` nem `C:\Windows\Media`. Lá, o comando precisa ser outro (por exemplo, `afplay` no Mac).

## Testar o som antes

Rode no PowerShell (não no JSON, por isso com uma barra só):

```powershell
(New-Object Media.SoundPlayer 'C:\Windows\Media\Windows Unlock.wav').PlaySync()
```

Se não tocar, confira se o arquivo existe em `C:\Windows\Media` e se o volume do Windows está ligado.

## Personalizar

- **Outro som:** troque o nome do arquivo. Para ver as opções, liste a pasta com `Get-ChildItem C:\Windows\Media\*.wav` no PowerShell. Exemplos: `Windows Notify.wav`, `Windows Ding.wav`, `chimes.wav`, `tada.wav`. Também serve qualquer `.wav` seu, informando o caminho completo.
- **Barras no JSON:** dentro do `settings.json`, cada `\` do caminho vira `\\`, e as aspas do comando viram `\"`, como no exemplo acima. O `SoundPlayer` só toca `.wav`, não `.mp3`.
- **Som em todas as notificações:** remova a linha `"matcher": "permission_prompt",` para tocar também nos outros avisos (por exemplo, quando o Claude fica um tempo esperando você).
- **Desligar um som:** apague o bloco do evento correspondente (`Stop` ou `Notification`).

## Observação

O `settings.json` do PC antigo tem outras preferências: modelo Opus, tema escuro e modo de permissões automático (`"defaultMode": "auto"`). Elas não são necessárias para os sons. Se você copiar o arquivo inteiro, essas preferências vão junto.

Não copie o `.credentials.json` da mesma pasta, que guarda o seu login. No PC novo, faça o login de novo. Este repositório é público, então nunca coloque o `settings.json` com chaves ou o `.credentials.json` aqui.
