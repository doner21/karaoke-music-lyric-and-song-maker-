
import torch
import sys

print(f"Python Version: {sys.version}")
print(f"Torch Version: {torch.__version__}")
try:
    print(f"CUDA Available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"CUDA Device Name: {torch.cuda.get_device_name(0)}")
        print(f"CUDA Version: {torch.version.cuda}")
except Exception as e:
    print(f"Error checking CUDA: {e}")
