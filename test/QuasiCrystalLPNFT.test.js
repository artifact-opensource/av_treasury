const { expect } = require("chai");
const hardhat = require("hardhat");
require("@nomicfoundation/hardhat-chai-matchers");

describe("QuasiCrystalLPNFT", function () {
  let nft, owner, minter, governor, addr1, addr2, ethers;

  const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
  const METADATA_ROLE = "0x6bd6b5318a46e5fff572d5e4258a20774aab40cc35ac7680654b9081fcc82f80";
  const GOVERNOR = "0x1a6838efa4183e08fe3607359d1259272af9d4716f65e1a7b5921f78fd5a3c6a";

  let defaultParams;

  beforeEach(async function () {
    ethers = hardhat.ethers;
    [owner, minter, governor, addr1, addr2] = await ethers.getSigners();

    defaultParams = {
      agReserve: ethers.utils.parseUnits("100", 6),
      auReserve: ethers.utils.parseUnits("50", 6),
      liquidityAmount: ethers.utils.parseUnits("75", 6),
      volume24h: 1500,
      volatilityIndex: 35,
      liquidityDepth: 70,
      timeHeld: 45,
      openedAt: Math.floor(Date.now() / 1000) - 45 * 86400,
    };

    // Deploy library first
    const SVG = await ethers.getContractFactory("QuasiCrystalSVG");
    const svgLib = await SVG.deploy();
    await svgLib.deployed();

    // Deploy NFT with library linking
    const NFT = await ethers.getContractFactory("QuasiCrystalLPNFT", {
      libraries: {
        QuasiCrystalSVG: svgLib.address,
      },
    });
    nft = await NFT.deploy(
      "Quasi Crystal LP",
      "QCLP",
      owner.address,
      minter.address,
      governor.address
    );
    await nft.deployed();
  });

  describe("Deployment", function () {
    it("should set correct name and symbol", async function () {
      expect(await nft.name()).to.equal("Quasi Crystal LP");
      expect(await nft.symbol()).to.equal("QCLP");
    });

    it("should grant roles correctly", async function () {
      expect(await nft.hasRole(MINTER_ROLE, minter.address)).to.be.true;
      expect(await nft.hasRole(METADATA_ROLE, owner.address)).to.be.true;
      expect(await nft.hasRole(GOVERNOR, governor.address)).to.be.true;
    });

    it("should have correct default render params", async function () {
      const params = await nft.renderParams();
      expect(params.maxSymmetry).to.equal(13);
      expect(params.maxLines).to.equal(21);
      expect(params.bleedFactor).to.equal(13500);
      expect(params.targetSize).to.equal(200);
      expect(params.diagonalsEnabled).to.be.true;
      expect(params.ringEchoEnabled).to.be.true;
    });
  });

  describe("Minting", function () {
    it("should mint a new position NFT", async function () {
      const tx = await nft.connect(minter).mint(addr1.address, defaultParams);
      const receipt = await tx.wait();
      const tokenId = 0;

      expect(await nft.ownerOf(tokenId)).to.equal(addr1.address);

      const pos = await nft.getPosition(tokenId);
      expect(pos.agReserve).to.equal(defaultParams.agReserve);
      expect(pos.auReserve).to.equal(defaultParams.auReserve);

      // Verify mint seed is set (randomization)
      const seed = await nft.mintSeed(tokenId);
      expect(seed).to.not.equal(0);
    });

    it("should generate unique seeds for identical params", async function () {
      await nft.connect(minter).mint(addr1.address, defaultParams);
      await nft.connect(minter).mint(addr2.address, defaultParams);

      const seed1 = await nft.mintSeed(0);
      const seed2 = await nft.mintSeed(1);
      expect(seed1).to.not.equal(seed2);
    });

    it("should emit PositionMinted event", async function () {
      const tx = await nft.connect(minter).mint(addr1.address, defaultParams);
      const receipt = await tx.wait();
      // Event args: tokenId, owner, params (struct), seed
      // Struct comparison requires array form
      await expect(tx).to.emit(nft, "PositionMinted");
    });

    it("should revert when minting to zero address", async function () {
      await expect(
        nft.connect(minter).mint(ethers.constants.AddressZero, defaultParams)
      ).to.be.revertedWithCustomError(nft, "InvalidPosition");
    });

    it("should revert when both reserves are zero", async function () {
      const badParams = { ...defaultParams, agReserve: 0, auReserve: 0 };
      await expect(
        nft.connect(minter).mint(addr1.address, badParams)
      ).to.be.revertedWithCustomError(nft, "InvalidPosition");
    });

    it("should mint batch", async function () {
      await nft.connect(minter).mintBatch(
        [addr1.address, addr2.address],
        [defaultParams, defaultParams]
      );
      expect(await nft.ownerOf(0)).to.equal(addr1.address);
      expect(await nft.ownerOf(1)).to.equal(addr2.address);
      expect(await nft.totalSupply()).to.equal(2);
    });
  });

  describe("Metrics", function () {
    beforeEach(async function () {
      await nft.connect(minter).mint(addr1.address, defaultParams);
    });

    it("should refresh metrics", async function () {
      const tvl = ethers.utils.parseUnits("50000", 18);
      const health = 75;
      await nft.connect(addr1).refreshMetrics(0, tvl, health);

      const met = await nft.getMetrics(0);
      expect(met.tvlUSD).to.equal(tvl);
      expect(met.healthScore).to.equal(health);
      expect(met.valid).to.be.true;
    });

    it("should cap health at 100", async function () {
      await nft.connect(addr1).refreshMetrics(0, 100000, 150);
      const met = await nft.getMetrics(0);
      expect(met.healthScore).to.equal(100);
    });

    it("should revert for non-existent token", async function () {
      await expect(
        nft.connect(addr1).refreshMetrics(999, 0, 0)
      ).to.be.revertedWithCustomError(nft, "TokenDoesNotExist");
    });
  });

  describe("Render Params", function () {
    it("should update render params", async function () {
      const newParams = {
        maxSymmetry: 10,
        maxLines: 15,
        bleedFactor: 10000,
        targetSize: 150,
        diagonalsEnabled: false,
        ringEchoEnabled: false,
      };
      await nft.connect(owner).setRenderParams(newParams);

      const params = await nft.renderParams();
      expect(params.maxSymmetry).to.equal(10);
      expect(params.maxLines).to.equal(15);
      expect(params.bleedFactor).to.equal(10000);
      expect(params.targetSize).to.equal(150);
      expect(params.diagonalsEnabled).to.equal(false);
      expect(params.ringEchoEnabled).to.equal(false);
    });

    it("should revert for invalid params", async function () {
      const badParams = {
        maxSymmetry: 30,
        maxLines: 15,
        bleedFactor: 10000,
        targetSize: 150,
        diagonalsEnabled: false,
        ringEchoEnabled: false,
      };
      await expect(
        nft.connect(owner).setRenderParams(badParams)
      ).to.be.revertedWithCustomError(nft, "InvalidParams");
    });

    it("should revert for non-metadata role", async function () {
      const newParams = {
        maxSymmetry: 10,
        maxLines: 15,
        bleedFactor: 10000,
        targetSize: 150,
        diagonalsEnabled: false,
        ringEchoEnabled: false,
      };
      await expect(
        nft.connect(addr1).setRenderParams(newParams)
      ).to.be.revertedWithCustomError(nft, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Source Authorization", function () {
    it("should authorize a source", async function () {
      await nft.connect(owner).authorizeSource(addr1.address, true);
      expect(await nft.authorizedSources(addr1.address)).to.be.true;
    });

    it("should let authorized source refresh metrics", async function () {
      await nft.connect(minter).mint(addr1.address, defaultParams);
      await nft.connect(owner).authorizeSource(addr2.address, true);
      await nft.connect(addr2).refreshMetrics(0, 1000, 50);

      const met = await nft.getMetrics(0);
      expect(met.valid).to.be.true;
    });
  });

  describe("TVL", function () {
    it("should set accumulated TVL", async function () {
      await nft.connect(owner).setAccumulatedTvl(ethers.utils.parseUnits("50000", 18));
      expect(await nft.getTvl()).to.equal(ethers.utils.parseUnits("50000", 18));
    });
  });

  describe("Pausable", function () {
    it("should pause and unpause", async function () {
      await nft.connect(governor).pause();
      await expect(
        nft.connect(minter).mint(addr1.address, defaultParams)
      ).to.be.revertedWithCustomError(nft, "EnforcedPause");

      await nft.connect(governor).unpause();
      await nft.connect(minter).mint(addr1.address, defaultParams);
      expect(await nft.ownerOf(0)).to.equal(addr1.address);
    });
  });

  describe("Token URI", function () {
    it("should return valid token URI", async function () {
      await nft.connect(minter).mint(addr1.address, defaultParams);
      const uri = await nft.tokenURI(0);
      expect(uri).to.include("data:application/json;base64,");

      // Decode and verify JSON (strip null bytes from base64 decode)
      const decoded = Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString().replace(/\0/g, "");
      const json = JSON.parse(decoded);
      expect(json.name).to.equal("QuasiCrystal LP #0");
      expect(json.image).to.include("data:image/svg+xml;base64,");
      expect(json.attributes).to.be.an("array");
      expect(json.attributes.length).to.equal(7);
    });

    it("should revert for non-existent token", async function () {
      await expect(nft.tokenURI(999)).to.be.revertedWithCustomError(nft, "TokenDoesNotExist");
    });
  });
});
