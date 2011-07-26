// FFT from dsp.js, see below
      var FFT = function(bufferSize, sampleRate) {
        this.bufferSize   = bufferSize;
        this.sampleRate   = sampleRate;
        this.spectrum     = new Float32Array(bufferSize/2);
        this.real         = new Float32Array(bufferSize);
        this.imag         = new Float32Array(bufferSize);
        this.reverseTable = new Uint32Array(bufferSize);
        this.sinTable     = new Float32Array(bufferSize);
        this.cosTable     = new Float32Array(bufferSize);

        var limit = 1,
            bit = bufferSize >> 1;

        while ( limit < bufferSize ) {
          for ( var i = 0; i < limit; i++ ) {
            this.reverseTable[i + limit] = this.reverseTable[i] + bit;
          }

          limit = limit << 1;
          bit = bit >> 1;
        }

        for ( var i = 0; i < bufferSize; i++ ) {
          this.sinTable[i] = Math.sin(-Math.PI/i);
          this.cosTable[i] = Math.cos(-Math.PI/i);
        }
      };

      FFT.prototype.forward = function(buffer) {
        var bufferSize   = this.bufferSize,
            cosTable     = this.cosTable,
            sinTable     = this.sinTable,
            reverseTable = this.reverseTable,
            real         = this.real,
            imag         = this.imag,
            spectrum     = this.spectrum;

        if ( bufferSize !== buffer.length ) {
          throw "Supplied buffer is not the same size as defined FFT. FFT Size: " +
                bufferSize + " Buffer Size: " + buffer.length;
        }

        for ( var i = 0; i < bufferSize; i++ ) {
          real[i] = buffer[reverseTable[i]];
          imag[i] = 0;
        }

        var halfSize = 1,
            phaseShiftStepReal,	
            phaseShiftStepImag,
            currentPhaseShiftReal,
            currentPhaseShiftImag,
            off,
            tr,
            ti,
            tmpReal,	
            i;

        while ( halfSize < bufferSize ) {
          phaseShiftStepReal = cosTable[halfSize];
          phaseShiftStepImag = sinTable[halfSize];
          currentPhaseShiftReal = 1.0;
          currentPhaseShiftImag = 0.0;

          for ( var fftStep = 0; fftStep < halfSize; fftStep++ ) {
            i = fftStep;

            while ( i < bufferSize ) {
              off = i + halfSize;
              tr = (currentPhaseShiftReal * real[off]) - (currentPhaseShiftImag * imag[off]);
              ti = (currentPhaseShiftReal * imag[off]) + (currentPhaseShiftImag * real[off]);

              real[off] = real[i] - tr;
              imag[off] = imag[i] - ti;
              real[i] += tr;
              imag[i] += ti;

              i += halfSize << 1;
            }

            tmpReal = currentPhaseShiftReal;
            currentPhaseShiftReal = (tmpReal * phaseShiftStepReal) - (currentPhaseShiftImag * phaseShiftStepImag);
            currentPhaseShiftImag = (tmpReal * phaseShiftStepImag) + (currentPhaseShiftImag * phaseShiftStepReal);
          }

          halfSize = halfSize << 1;
	}

        i = bufferSize/2;
        while(i--) {
          spectrum[i] = 2 * Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / bufferSize;
	}
      };
