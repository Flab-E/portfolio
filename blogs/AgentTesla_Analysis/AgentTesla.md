- MD5: `65dd5102f8648aa303711d62cec6bc9a`
- Virus Total: `https://www.virustotal.com/gui/file/7c4072f5ae6fdf61d9f6d051a5bad41290e6e66e5a564110ec97a256fd4980b4`
- File Size: 185 KB  
  
# Static Analysis
## Overview
### > Sample
`https://bazaar.abuse.ch/sample/7c4072f5ae6fdf61d9f6d051a5bad41290e6e66e5a564110ec97a256fd4980b4/`  
This sample was collected from Mlaware Bazaar on 8th October. At that time, the executable file name that we get within the archive had a low score of 10 on VirusTotal, which has significantly gone up now.  
  
![[Pasted image 20251009215151.png]]
  
### > File
![[Pasted image 20251008225743.png]]
  
### > Floss
-> Interesting strings  
`SOFTWARE\Microsoft\Windows NT\CurrentVersion`  
`C92S1PNJBD3LKYI0ZA58TG0R024KX5064SBEBQQT.exe`  
  
-> There's a big list of text that is seemingly encoded in base64. Refer to this extensive floss output. Other than a few strings, and imported libraries/functions nothing much to see here. However, I will be coming back to this later. The link to the output from floss is attached below.
***[[floss_output.txt]]***

### > [[PE Studio]]

#### => Metadata
![[Pasted image 20251009225024.png]]  
  
-> 32 bit executable  
-> compiler timestamp: June 12th, 2017; 10:33:35  
Everything seems normal and straightforward here. 

#### => Sections Sizes
![[Pasted image 20251011142142.png]]  
  
-> We need to look at the differece between the physical and virtual size of these sections. If the difference is large, say by 100s of MBs or more, then it's a very good indicator of some sort of compression, packer or process injection.
-> Here, it looks like no packers are involved as there's not a lot of change in raw and virtual sizes.  
  
**Estimated File Size: 184 KB**  
- apparently average for stealers or loaders  

### => Libraries or Imports
![[Pasted image 20251011191809.png]]
  
-> Imports shows (flag > 25): showing that heuristically the libraries and the functions imported are really suspicious. Though this is not a decider, but more of a probability indicator, a feature of PE Studio (the tool used in the static analysis).

### => Flagged imports:
| Function                 | Namespace  | Flag | Type      | Library      |
| ------------------------ | ---------- | ---- | --------- | ------------ |
| DeleteFile               | -          | x    | p/Invoke  | kernel32.dll |
| MoveFileExW              | -          | x    | p/Invoke  | kernel32.dll |
| GetLastInputInfo         | -          | x    | p/Invoke  | user32.dll   |
| GetForegroundWindow      | -          | x    | p/Invoke  | user32.dll   |
| GetWindowThreadProcessId | -          | x    | p/Invoke  | user32.dll   |
| GetKeyboardState         | -          | x    | p/Invoke  | user32.dll   |
| MapVirtualKey            | -          | x    | p/Invoke  | user32.dll   |
| UnhookWindowsHookEx      | -          | x    | p/Invoke  | user32.dll   |
| SetWindowsHookExA        | -          | x    | p/Invoke  | user32.dll   |
| CallNextHookEx           | -          | x    | p/Invoke  | user32.dll   |
| SetClipboardViewer       | -          | x    | p/Invoke  | user32.dll   |
| ChangeClipboardChain     | -          | x    | p/Invoke  | user32.dll   |
| capCreateCaptureWindowA  | -          | x    | p/Invoke  | avicap32.dll |
| SetKernelObjectSecurity  | -          | x    | p/Invoke  | advapi32.dll |
| GetKernelObjectSecurity  | -          | x    | p/Invoke  | advapi32.dll |
| GetCurrentProcess        | -          | x    | p/Invoke  | kernel32.dll |
| SetDllDirectory          | -          | x    | p/Invoke  | kernel32.dll |
| GetEnvironmentVariable   | -          | x    | MemberRef | mscoree.dll  |
| CreateDirectory          | -          | x    | MemberRef | mscoree.dll  |
| Run                      | -          | x    | MemberRef | mscoree.dll  |
| GetProcessesByName       | -          | x    | MemberRef | mscoree.dll  |
| Send                     | -          | x    | MemberRef | mscoree.dll  |
| DownloadFile             | -          | x    | MemberRef | mscoree.dll  |
| set_UseShellExecute      | -          | x    | MemberRef | mscoree.dll  |
| MemoryStream             | System.IO  | x    | TypeRef   | mscoree.dll  |
  
#### => Applications of these imports  
Below are the applications or usage of a set of imports.
-> Basic file handling involved: \[`DeleteFile`, `MoveFileExW`, `CreateDirectory`]  
-> User activity handlers: \[`GetLastInputInfo`, `GetForegroundWindow`,`GetWindowThreadProcessId`, `GetKeyboardState`, `MapVirtualKey`, `SetWindowsHookExA`, `CallNextHookEx`, `UnhookWindowsHookEx`, `SetClipboardViewer`, `ChangeClipboardChain`]  
-> webcam/screen capture: `capCreateCaptureWindowA`  
-> security/ privilege manipulation: \[`GetKernelObjectSecurity`, `SetKernelObjectSecurity`, `GetCurrentProcess`, `SetDllDirectory`]  
-> .NET runtime: \[`Run`, `Send`, `DownloadFile`, `GetProcessesByName`, `GetEnvironmentVariable`, `MemoryStream`, `set_UseShellExecute`]  
  
> This was easy to classify with a little bit of research and thanks to the prior knowledge that this was an AgentTesla sample, which is a known infostealer and keylogger.  
  
	
# Behavior Analysis
## Detect-It-Easy  
  
![[Pasted image 20251017232628.png]]
  
> (Heur) Protection: Obfuscation\[Modified EP]  
This means that the Entrypoint (EP) has either been modified or jumps to a different section or code.  By toggling on the Advanced view of DiE, we can see a lot more information.  
- Enrypoint address: `0x0042fdce`  
By clicking the arrow mark under `Sections` tab we can see the hex view. Navigate to the address to find this:  
  
![[Pasted image 20251017235128.png]]  
  
Here, `ff 2f` indicates an import-based jump instruction / IAT thunk, which seems suspicious. The following bytes are: `00 20 40 00`. This implies that, the entrypoint is a jump instruction to the address x0004020 (little endian). .NET executables do have jump instructions at their entrypoints, this is not uncommon but might be good to check it out (considering I am starting off with malware analysis, I should check it out). `0x00402000` is the start of my sample, here's what it has:  
  
![[Pasted image 20251018130847.png]]
  
Now, `b0 fd 02 00` is a pointer in little-endian: `0x0002fdb0` (`0x0042fdb0`). This is very suspicious as it seems to point to an internal address within the base `0x00400000`, not typical to benign applications. I learnt that these types of jumps are typical to packers or custom loader stub and not a compiler generated entry. But when you follow that pointer here is what we see, and this removes any suspicion.  
  
![[Pasted image 20251018132924.png]]
  
This indicates to a Dynamically Linked Library: `_CorExeMain.mscoree.dll`. Everything seems normal as his is a common dll used with .NET applications. Detect-it-Easy told us result at the very beginning by stating that this is a .NET application, however, it's good to learn and understand what that particular heuristic flag was for. This was something my mind was wondering about and I ended going through that path.  
  
> Now we know that this is a legitimate loader stub for .NET  
  
  
## DNSpy  
- When we load our binary into DNSpy, class names, variables and content seems obfuscated  
- we can deobfuscate with `de4dot.exe`  
```
de4dot.exe calc.mal.exe -o clean.mal.exe  # use clean.mal.exe for analysis
```
  
All strings seem to be obfuscated as shown below. This snippet was part of the main function where initial OS and Registry checks happen. The `decrypt_b64_AES` seems to be called to decrypt all strings and then pass it as arguments. This function name was not shown of course, I assigned it after analysing what it does to simplify the code.  
  
```
string osfullName = Class2.Class1_0.Info.OSFullName;
if (osfullName.Contains(<Module>.decrypt_b64_AES("jt4JXyzFY+P3zf6k/0mkCA==")) | osfullName.Contains(<Module>.decrypt_b64_AES("WY/qFt+dX2Df9KlaXwh7Dg==")) | osfullName.Contains(<Module>.decrypt_b64_AES("yELl4NlRz7vMnB6B63zUbg==")))
{
	int num = Conversions.ToInteger(Class2.Class1_0.Registry.GetValue(
		<Module>.decrypt_b64_AES("K0ocYJdpSlFAvhxHrgztFQgMSAGTR4Y34Eo23ag/X4fpmLi/O+20Ac6XwZSCbadNtIahNa80MTpAMCWN3QkiFxfHyRWD2OvLT9n8OC99lDs="), 
		<Module>.decrypt_b64_AES("1jb8AudXf9ptWpuwzIAMvw=="), 
		<Module>.decrypt_b64_AES("84htGJR8cIVATCAwL9pcMw=="))
	);
	
	if (num == 1)
	{
		try
		{
			Class2.Class1_0.Registry.SetValue(
				<Module>.decrypt_b64_AES("K0ocYJdpSlFAvhxHrgztFQgMSAGTR4Y34Eo23ag/X4fpmLi/O+20Ac6XwZSCbadNtIahNa80MTpAMCWN3QkiFxfHyRWD2OvLT9n8OC99lDs="), 
				<Module>.decrypt_b64_AES("1jb8AudXf9ptWpuwzIAMvw=="), <Module>.decrypt_b64_AES("h70oAKbD4BDUEdcNDLfT7A==")
			);
		}
		catch (Exception ex){}
		Class5.smethod_0(Assembly.GetExecutingAssembly().Location);
	}       
}
```
  
- ***[[agentTesla_string_decryptor.ps1]]*** is a small powershell script I created to decrypt these strings and see what is being passed as arguments in these encrypted strings.  
- Looking at ***[[floss_output.txt]]*** it's pretty evident that we will find a lot of these base64 encoded strings. This powershell script will definitely be helpful in analyzing this malware.  
  
### Overview  
#### Setup  
- The malware first checks the value that is set for the registry key `HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System\EnableLua`
	- If it's value is 1, it sets it to 0 automatically. This is to disable UAC (User Access Control) allowing the malware to make key changes to System32, and other vital systems
- The following registry is used for persistence: `Software\Microsoft\Windows\CurrentVersion\Run`, where a subkey is opened called `JavaUpdtr`
- Uses `%appdata$\Java\` directory
- Uses  the following file: `%appdata%\Java|JavaUpdtr.exe` (as a Hidden file)
#### Anti-analysis
- Runs a function to check and delete a known list of AV, analysis or evidence collection tool. This thread runs every 5 mins. Following is the list of process names it checks for:
  1. anubis
  2. a2servic
  3. ashWebSv
  4. hvk
  5. avgemc
  6. bdagent
  7. avp
  8. keyscrambler
  9. mbam
  10. ekrn
### Pre-attack
Disables the following for the current user (and some for local machine too): UAC, task manager, cmd, run option or menu, control panel, regedit.exe, system restore, folder options (to disallow users from seeing hidden files or file extensions), user from finding msconfig through menu or explorer (tool used to view or manage startup apps, service, boot options and so on)
