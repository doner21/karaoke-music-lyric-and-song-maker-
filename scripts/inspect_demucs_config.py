
import torch
import demucs.api
import demucs.separate
import sys

def inspect_device(device_name):
    print(f"--- Inspecting Device: {device_name} ---")
    try:
        # Check availability
        if device_name == 'cuda' and not torch.cuda.is_available():
            print("CUDA not available, skipping.")
            return

        # Initialize separator to see defaults
        # Note: Demucs API usage might vary by version. 
        # We try to mimic how the CLI might set things up or check defaults.
        
        # We can check the 'demucs.separate' module defaults or 'demucs.apply'
        
        print(f"Torch Default Dtype: {torch.get_default_dtype()}")
        
        # Check what arguments 'demucs.separate.main' parses or defaults to
        # But easier: instantiate a model or check the 'apply_model' signature defaults
        
        from demucs.apply import apply_model
        import inspect
        sig = inspect.signature(apply_model)
        for name, param in sig.parameters.items():
            print(f"apply_model param: {name} = {param.default}")

    except Exception as e:
        print(f"Error inspecting {device_name}: {e}")

print("Python executable:", sys.executable)
print("Demucs version:", demucs.__version__ if hasattr(demucs, '__version__') else "unknown")

inspect_device('cpu')
inspect_device('cuda')
