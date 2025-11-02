### Decrypt the encrypted strings in AgentTesla
```
$in="<b64_string>"
powershell -File .\decryptor.ps1 $in
```

```powershell
# decrypt_dotnet.ps1

param([string[]]$Inputs)

$pwd = "amp4Z0wpKzJ5Cg0GDT5sJD0sMw0IDAsaGQ1Afik6NwXr6rrSEQE="
$saltText = "aGQ1Afik6NampDT5sJEQE4Z0wpsMw0IDAD06rrSswXrKzJ5Cg0G="
$iv = [System.Text.Encoding]::ASCII.GetBytes("@1B2c3D4e5F6g7H8")

function DecryptOne($b64) {
    try {
        $data = [Convert]::FromBase64String($b64)
    } catch { 
        Write-Output "INPUT_NOT_BASE64: $b64"; 
        return 
    }
    
    # use ASCII bytes of the salt string (matches sample)
    $saltBytes = [System.Text.Encoding]::ASCII.GetBytes($saltText)
    $pdb = New-Object System.Security.Cryptography.PasswordDeriveBytes($pwd,$saltBytes,"SHA1",2)
    $key = $pdb.GetBytes(32)
    
    $aes = New-Object System.Security.Cryptography.RijndaelManaged
    $aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
    $dec = $aes.CreateDecryptor($key,$iv)
    
    try {
        $ms = New-Object System.IO.MemoryStream(,$data)
        $cs = New-Object System.Security.Cryptography.CryptoStream($ms,$dec,[System.Security.Cryptography.CryptoStreamMode]::Read)
        $buf = New-Object byte[] $data.Length
        $len = $cs.Read($buf,0,$buf.Length)
        $cs.Close(); $ms.Close()
        
        $txt = [System.Text.Encoding]::UTF8.GetString($buf,0,$len)
        if ($txt -match '^[\x20-\x7E\r\n\t]+$') { 
            Write-Output "TEXT: $txt" 
        } else { 
            Write-Output ("HEX: " + ([BitConverter]::ToString($buf,0,$len) -replace '-','')) 
        }
    } catch {
        # fallback: try TransformFinalBlock (may throw padding), print hex of partial decrypt
        try {
            $dec2 = ([System.Security.Cryptography.Rijndael]::Create()).CreateDecryptor($key,$iv)
            $plain = $dec2.TransformFinalBlock($data,0,$data.Length)
            $txt2 = [System.Text.Encoding]::UTF8.GetString($plain)
            if ($txt2 -match '^[\x20-\x7E\r\n\t]+$') { 
                Write-Output "TEXT2: $txt2" 
            } else { 
                Write-Output ("HEX2: " + ([BitConverter]::ToString($plain) -replace '-','')) 
            }
        } catch {
            Write-Output "DECRYPT_FAIL: $b64"
        }
    }
}

if (-not $Inputs) { 
    Write-Output "Usage: .\decrypt_dotnet.ps1 <b64> [b64] ..."; 
    exit 1 
}

foreach ($i in $Inputs) { 
    Write-Output "----"; 
    Write-Output "INPUT: $i"; 
    DecryptOne $i 
}
```