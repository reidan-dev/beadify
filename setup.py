from setuptools import setup, find_packages

setup(
    name="beadify",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "fastapi>=0.110.0",
        "uvicorn[standard]>=0.29.0",
        "pillow>=10.0.0",
        "numpy>=1.26.0",
        "scipy>=1.9",
        "python-multipart>=0.0.9",
        "pyyaml>=6.0",
    ],
    entry_points={
        "console_scripts": [
            "beadify=main:run",
        ],
    },
)